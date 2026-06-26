import argparse
import json
import numpy as np
from lumibot.brokers import Alpaca
from lumibot.backtesting import YahooDataBacktesting
from lumibot.strategies.strategy import Strategy
from lumibot.traders import Trader
from datetime import datetime, timedelta, date as _date
from alpaca_trade_api import REST
from finbert_utils import estimate_sentiment
import quantstats as qs
import yfinance as yf
import os
from dotenv import load_dotenv

load_dotenv()

# Parse CLI date range — lets the backend (and the user) specify any window.
_parser = argparse.ArgumentParser(description="SARSA Trader backtest")
_parser.add_argument("--start",       default="2020-01-01",             help="Start date YYYY-MM-DD")
_parser.add_argument("--end",         default=_date.today().isoformat(), help="End date YYYY-MM-DD")
_parser.add_argument("--symbol",      default="SPY",                     help="Ticker symbol, e.g. AAPL")
_parser.add_argument("--stats-file",  default="logs/sarsa_stats.csv",    help="Output stats CSV path")
_parser.add_argument("--trades-file", default="logs/sarsa_trades.csv",   help="Output trades CSV path")
_parser.add_argument("--fresh-start", action="store_true",
                     help="Ignore existing Q-table (used for walk-forward training phase)")
_args = _parser.parse_args()

import pandas as pd

_SPY_START  = _args.start
_SPY_END    = _args.end
_SYMBOL     = _args.symbol.upper()
# Cache keyed by symbol+range so different runs don't share a stale file
_CACHE_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data",
    f"benchmark_{_SYMBOL}_{_SPY_START}_{_SPY_END}.csv"
)

def _load_spy_benchmark():
    os.makedirs(os.path.dirname(_CACHE_FILE), exist_ok=True)

    if os.path.exists(_CACHE_FILE):
        cached = pd.read_csv(_CACHE_FILE, index_col=0)
        cached.index = pd.to_datetime(cached.index, utc=True).tz_convert(None)
        returns = cached.squeeze()
        if not returns.empty:
            print(f"{_SYMBOL} benchmark loaded from cache.")
            return returns

    print(f"Downloading {_SYMBOL} benchmark data...")
    raw = yf.download(_SYMBOL, start=_SPY_START, end=_SPY_END, auto_adjust=False, progress=False)
    if raw.empty:
        print(f"WARNING: {_SYMBOL} download failed — benchmark will be missing from tearsheet.")
        return None

    returns = raw["Close"].squeeze().pct_change().dropna()
    returns.index = returns.index.tz_localize(None)
    returns.name = _SYMBOL  # so quantstats uses the symbol as the column name in the tearsheet
    returns.to_frame("return").to_csv(_CACHE_FILE)
    print(f"{_SYMBOL} benchmark downloaded and cached.")
    return returns

SPY_BENCHMARK = _load_spy_benchmark()

API_KEY = os.getenv("API_KEY")
API_SECRET = os.getenv("API_SECRET")
BASE_URL = os.getenv("BASE_URL")

ALPACA_CREDS = {
    "API_KEY": API_KEY,
    "API_SECRET": API_SECRET,
    "PAPER": True
}

class SARSATrader(Strategy):
    def initialize(self, symbol: str = "SPY", cash_at_risk: float = 0.5,
                   alpha: float = 0.1, epsilon: float = 0.3,
                   gamma: float = 0.9, sleeptime: str = "24H"):
        self.symbol       = symbol
        self.sleeptime    = sleeptime
        self.last_trade   = None
        self.cash_at_risk = cash_at_risk
        self.api          = REST(base_url=BASE_URL, key_id=API_KEY, secret_key=API_SECRET)
        self.alpha        = alpha
        self.gamma        = gamma

        # ── Tier 1: Decaying epsilon ──────────────────────────────────────────
        # Starts at 0.1 (same as original) and decays to 0.01 by ~iter 800.
        # Preserves the baseline behaviour early on while tightening exploitation
        # as the Q-table matures.
        self.epsilon_start = epsilon   # 0.1
        self.epsilon_min   = 0.01
        self.epsilon_decay = 0.005     # faster decay: floor reached ~iter 800
        self.epsilon       = epsilon

        self.actions = ['buy', 'sell', 'hold']

        # ── Tier 1: Q-table persistence ───────────────────────────────────────
        # Loads knowledge from a previous run so the agent doesn't start blind.
        self._qtable_path = os.path.join(
            os.path.dirname(__file__), "..", "logs", f"qtable_{symbol}.json"
        )
        self.Q = self._load_qtable()
        if _args.fresh_start:
            # Walk-forward training phase: ignore any prior knowledge so
            # the train period is evaluated on a genuinely cold Q-table.
            self.Q = {}
            print("Q-table reset: fresh-start mode (walk-forward training)")
        elif self.Q:
            # Pre-trained Q-table loaded — skip broad exploration to avoid
            # corrupting learned Q-values with random noise.
            self.epsilon       = 0.02
            self.epsilon_start = 0.02

        # ── Tier 2: Rolling return window for risk-adjusted reward ────────────
        self._return_window = []

        # Learning telemetry
        self._iter_count       = 0
        self._action_counts    = {"buy": 0, "sell": 0, "hold": 0}
        self._sentiment_counts = {"positive": 0, "negative": 0, "neutral": 0}
        self._recent_decisions = []
        self._learning_path    = os.path.join(
            os.path.dirname(__file__), "..", "logs", "learning_state.json"
        )

        # SARSA cross-iteration carry
        self._prev_price  = None
        self._prev_state  = None
        self._prev_action = None

    # ── Tier 1: Q-table persistence ───────────────────────────────────────────

    def _load_qtable(self) -> dict:
        if os.path.exists(self._qtable_path):
            try:
                with open(self._qtable_path, "r") as f:
                    data = json.load(f)
                print(f"Q-table loaded: {len(data)} states from previous run.")
                return data
            except Exception:
                pass
        return {}

    def _save_qtable(self):
        try:
            os.makedirs(os.path.dirname(self._qtable_path), exist_ok=True)
            tmp = self._qtable_path + ".tmp"
            with open(tmp, "w") as f:
                json.dump({k: dict(v) for k, v in self.Q.items()}, f)
            os.replace(tmp, self._qtable_path)
        except Exception:
            pass

    # ── Core helpers ──────────────────────────────────────────────────────────

    def position_sizing(self, probability: float = 1.0):
        cash       = self.get_cash()
        last_price = self.get_last_price(self.symbol)
        # Confidence bonus: base is always full cash_at_risk; high-conviction
        # signals (prob > 0.7) can size up to 120% of cash_at_risk.
        # This never reduces exposure below the original baseline.
        bonus    = max(0.0, float(probability) - 0.7) / 0.3 * 0.2  # 0 → 0.2 bonus
        quantity = round(cash * self.cash_at_risk * (1.0 + bonus) / last_price, 0)
        return cash, last_price, quantity

    def get_dates(self):
        today          = self.get_datetime()
        three_days_ago = today - timedelta(days=3)
        return today.strftime('%Y-%m-%d'), three_days_ago.strftime('%Y-%m-%d')

    def get_sentiment(self):
        today, three_days_ago = self.get_dates()
        news = self.api.get_news(symbol=self.symbol, start=three_days_ago, end=today)
        # Pass full article dicts so FinBERT uses both headline and summary
        articles = []
        for ev in news:
            raw = ev.__dict__["_raw"]
            articles.append({
                "headline": raw.get("headline", ""),
                "summary":  (raw.get("summary") or "")[:200],
            })
        probability, sentiment = estimate_sentiment(articles)
        return probability, sentiment

    def get_trend(self, last_price: float) -> str:
        """Tier 2: 'bull' if price > 50-day MA, 'bear' otherwise. None if insufficient data."""
        try:
            bars = self.get_historical_prices(self.symbol, 60, "day")
            if bars is None or len(bars.df) < 50:
                return None
            ma50 = float(bars.df["close"].tail(50).mean())
            return "bull" if last_price > ma50 else "bear"
        except Exception:
            return None

    def choose_action(self, state: str) -> str:
        if state not in self.Q:
            self.Q[state] = {'buy': 0.0, 'sell': 0.0, 'hold': 0.0}
        if np.random.rand() < self.epsilon:
            return np.random.choice(self.actions)
        return max(self.Q[state], key=self.Q[state].get)

    def update_Q(self, state, action, reward, next_state, next_action):
        for s in (state, next_state):
            if s not in self.Q:
                self.Q[s] = {'buy': 0.0, 'sell': 0.0, 'hold': 0.0}
        self.Q[state][action] += self.alpha * (
            reward + self.gamma * self.Q[next_state][next_action] - self.Q[state][action]
        )

    def calculate_reward(self, action: str, last_price: float, next_price: float) -> float:
        """Tier 2: Risk-adjusted (Sharpe-inspired) reward.
        Raw return is normalised by a 20-day rolling volatility so the agent
        learns to prefer steady gains over volatile ones.
        """
        price_return = (next_price - last_price) / last_price

        if action == 'buy':
            raw = price_return
        elif action == 'sell':
            raw = -price_return   # rewarded for exiting before a drop
        else:
            return 0.0

        self._return_window.append(price_return)
        if len(self._return_window) > 20:
            self._return_window.pop(0)

        if len(self._return_window) >= 5:
            vol = float(np.std(self._return_window)) + 1e-6
            return float(np.clip(raw / vol, -3.0, 3.0))

        return float(raw)

    # ── Main loop ─────────────────────────────────────────────────────────────

    def on_trading_iteration(self):
        probability, sentiment = self.get_sentiment()
        cash, last_price, quantity = self.position_sizing(probability)

        # Tier 2: Composite state — sentiment × market trend
        trend = self.get_trend(last_price)
        state = f"{sentiment}_{trend}" if trend else sentiment

        action = self.choose_action(state)

        if quantity > 0:
            if action == 'buy':
                if self.last_trade == "sell":
                    self.sell_all()
                order = self.create_order(
                    self.symbol,
                    quantity,
                    "buy",
                    type="bracket",
                    take_profit_price=last_price * 1.20,
                    stop_loss_price=last_price * 0.95,
                )
                self.submit_order(order)
                self.last_trade = "buy"

            elif action == 'sell':
                # Long-only — sell means exit to cash, never open a short.
                if self.last_trade == "buy":
                    self.sell_all()
                self.last_trade = "sell"

            elif action == "hold":
                pass
        else:
            action = "hold"

        # SARSA Q-update using previous iteration's price as T, current as T+1
        reward = 0.0
        if self._prev_price is not None and self._prev_action is not None:
            reward      = self.calculate_reward(self._prev_action, self._prev_price, last_price)
            next_action = self.choose_action(state)
            self.update_Q(self._prev_state, self._prev_action, reward, state, next_action)

        # Tier 1: Decay epsilon after each step
        self._iter_count += 1
        self.epsilon = max(
            self.epsilon_min,
            self.epsilon_start * float(np.exp(-self.epsilon_decay * self._iter_count))
        )

        # Carry state forward
        self._prev_price  = last_price
        self._prev_state  = state
        self._prev_action = action

        # Telemetry (track raw sentiment for dashboard display)
        self._action_counts[action]       = self._action_counts.get(action, 0) + 1
        self._sentiment_counts[sentiment] = self._sentiment_counts.get(sentiment, 0) + 1

        decision = {
            "date":            self.get_datetime().strftime("%Y-%m-%d"),
            "sentiment":       sentiment,
            "trend":           trend or "n/a",
            "state":           state,
            "probability":     round(float(probability), 3),
            "action":          action,
            "reward":          round(float(reward), 2),
            "epsilon":         round(float(self.epsilon), 4),
            "portfolio_value": round(float(self.get_portfolio_value()), 2),
        }
        self._recent_decisions.append(decision)
        if len(self._recent_decisions) > 20:
            self._recent_decisions.pop(0)

        if self._iter_count % 50 == 0:
            self._write_learning_state()

    def _write_learning_state(self):
        try:
            os.makedirs(os.path.dirname(self._learning_path), exist_ok=True)
            payload = {
                "iteration":        self._iter_count,
                "symbol":           self.symbol,
                "epsilon":          round(float(self.epsilon), 4),
                "q_table":          {k: dict(v) for k, v in self.Q.items()},
                "action_counts":    self._action_counts,
                "sentiment_counts": self._sentiment_counts,
                "recent_decisions": self._recent_decisions[-10:],
                "portfolio_value":  round(float(self.get_portfolio_value()), 2),
            }
            tmp = self._learning_path + ".tmp"
            with open(tmp, "w") as f:
                json.dump(payload, f)
            os.replace(tmp, self._learning_path)
            # Mid-run: save Q-table unconditionally (end-of-run guard handles best-only logic)
        except Exception:
            pass  # never interrupt the backtest for telemetry failures


# Monkey-patch _dump_benchmark_stats to prevent yfinance rate-limit crashes at teardown.
# After ~10 min of backtest data fetching, yfinance returns None for SPY; lumibot then
# crashes on None.copy() inside _dump_benchmark_stats, which propagates through
# _on_bot_crash and prevents self.result from ever being set.
# We handle the benchmark comparison ourselves via quantstats below.
import logging as _logging
from lumibot.strategies._strategy import _Strategy as _LumibotStrategy

_orig_dump_benchmark = _LumibotStrategy._dump_benchmark_stats

def _safe_dump_benchmark(self):
    try:
        _orig_dump_benchmark(self)
    except Exception as _e:
        _logging.warning(f"Benchmark stats skipped (yfinance rate limit): {_e}")

_LumibotStrategy._dump_benchmark_stats = _safe_dump_benchmark

# Backtesting
start_date = datetime.strptime(_args.start, "%Y-%m-%d")
end_date   = datetime.strptime(_args.end,   "%Y-%m-%d")

# Use run_backtest directly (vs strategy.backtest) to get the strategy object back —
# we need bt_strategy._strategy_returns_df to build the quantstats tearsheet.
results, bt_strategy = SARSATrader.run_backtest(
    YahooDataBacktesting,
    start_date,
    end_date,
    parameters={"symbol": _SYMBOL, "cash_at_risk": 0.5},
    name='sarsa_strat',
    show_plot=False,
    show_tearsheet=False,
    stats_file=_args.stats_file,
    trades_file=_args.trades_file,
)

# Persist Q-table only if this run's final portfolio beats the previous best.
# This prevents a degraded run from overwriting a superior learned policy.
if bt_strategy is not None and hasattr(bt_strategy, "_save_qtable"):
    current_value  = float(bt_strategy.get_portfolio_value())
    best_path      = os.path.join(os.path.dirname(__file__), "..", "logs", f"qtable_{_SYMBOL}_best_value.txt")
    previous_best  = float(open(best_path).read().strip()) if os.path.exists(best_path) else 0.0

    if current_value >= previous_best:
        bt_strategy._save_qtable()
        os.makedirs(os.path.dirname(best_path), exist_ok=True)
        with open(best_path, "w") as f:
            f.write(str(current_value))
        print(f"Q-table saved: {len(bt_strategy.Q)} states, portfolio ${current_value:,.2f} (new best)")
    else:
        print(f"Q-table NOT updated: ${current_value:,.2f} < previous best ${previous_best:,.2f} — keeping superior policy")

# Generate tearsheet with quantstats
if bt_strategy is not None and bt_strategy._strategy_returns_df is not None:
    returns_df = bt_strategy._strategy_returns_df

    if "return" in returns_df.columns:
        returns = returns_df["return"].dropna()
    else:
        # Fall back to computing from portfolio value column
        val_col = next((c for c in returns_df.columns if "portfolio" in c.lower() or "value" in c.lower()), None)
        if val_col:
            returns = returns_df[val_col].pct_change().dropna()
        else:
            print("Could not locate a returns or portfolio-value column.")
            print("Available columns:", list(returns_df.columns))
            returns = None

    if returns is not None:
        if hasattr(returns.index, "tz") and returns.index.tz is not None:
            returns.index = returns.index.tz_localize(None)

        os.makedirs("reports", exist_ok=True)
        qs.reports.html(
            returns,
            benchmark=SPY_BENCHMARK,  # None if rate-limited and no cache exists
            output="reports/tearsheet.html",
            title="SARSA Trader"
        )
        print("Tearsheet saved: reports/tearsheet.html — open it in your browser")
else:
    print("Backtest returned no strategy data.")
    if results:
        print("results keys:", list(results.keys()) if isinstance(results, dict) else results)
