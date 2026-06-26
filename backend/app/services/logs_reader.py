"""
Reads lumibot backtest output from the repo-root logs/ directory.

Lumibot saves files named like:
  logs/SARSATrader_YYYY-MM-DD_HH-MM_<id>_stats.csv
  logs/SARSATrader_YYYY-MM-DD_HH-MM_<id>_trades.csv
  logs/SARSATrader_YYYY-MM-DD_HH-MM_<id>_settings.json

We always use the most-recently-modified pair so the API reflects
the latest completed backtest.
"""
import os
import glob
import json
import pandas as pd
from typing import Optional

# Resolve logs/ relative to repo root (two levels up from this file)
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_LOGS_DIR = os.path.join(_REPO_ROOT, "logs")


def _latest_file(suffix: str) -> Optional[str]:
    pattern = os.path.join(_LOGS_DIR, f"*{suffix}")
    files = glob.glob(pattern)
    if not files:
        return None
    return max(files, key=os.path.getmtime)


def _sanitize(obj):
    """Recursively replace inf/nan floats with None so json.dumps won't crash."""
    import math
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def get_last_run_time() -> Optional[str]:
    """Return the mtime of the most recent stats file as an ISO-8601 string."""
    path = _latest_file("_stats.csv")
    if path is None:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc).isoformat()


def _is_timeseries(df: pd.DataFrame) -> bool:
    """
    Lumibot saves the portfolio time-series (dates as index) to stats_file.
    Detect this by checking whether the index looks like datetimes.
    """
    try:
        pd.to_datetime(df.index[:5])
        return True
    except Exception:
        return False


def get_stats(stats_file: Optional[str] = None) -> Optional[dict]:
    """
    Return summary performance metrics.

    stats_file: explicit path relative to repo root (for walk-forward per-phase files).
                When None, falls back to the most recent *_tearsheet.csv or *_stats.csv.

    Prefers *_tearsheet.csv (QuantStats summary) over *_stats.csv.
    Strategy column is returned first so extractStat(stats, ..., column=0) works.
    """
    if stats_file is not None:
        # Explicit path requested (walk-forward / multi-symbol phases)
        full_path = os.path.join(_REPO_ROOT, stats_file)
        if not os.path.exists(full_path):
            return None
        df = pd.read_csv(full_path, index_col=0)
        if _is_timeseries(df):
            return None
        return _sanitize(df.to_dict())

    # Prefer tearsheet CSV — it has real summary metrics
    path = _latest_file("_tearsheet.csv")
    if path:
        df = pd.read_csv(path, index_col=0)
        df = df[df.index.notna() & (df.index.str.strip() != "")]
        if "Strategy" in df.columns:
            other_cols = [c for c in df.columns if c != "Strategy"]
            ordered = {col: df[col].to_dict() for col in ["Strategy"] + other_cols}
            return _sanitize(ordered)

    # Fall back to *_stats.csv
    path = _latest_file("_stats.csv")
    if path is None:
        return None
    df = pd.read_csv(path, index_col=0)
    if _is_timeseries(df):
        return None
    return _sanitize(df.to_dict())


def get_trades() -> list[dict]:
    """Return all rows from the most recent trades CSV as a list of dicts."""
    path = _latest_file("_trades.csv")
    if path is None:
        return []
    df = pd.read_csv(path)
    df = df.where(pd.notnull(df), None)  # convert NaN → None for JSON
    return _sanitize(df.to_dict(orient="records"))


def get_portfolio_values() -> list[dict]:
    """
    Return portfolio value time series from the most recent stats CSV.

    Lumibot's stats_file is a time-series CSV with columns like:
      portfolio_value, cash, positions, return
    The index is a datetime string.  We keep only numeric columns and
    rename the index to 'date' for the frontend chart.
    """
    path = _latest_file("_stats.csv")
    if path is None:
        return []
    df = pd.read_csv(path, index_col=0)
    if not _is_timeseries(df):
        return []

    # Keep only numeric columns (drop 'positions' which is a serialised list)
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if not numeric_cols:
        return []

    result = df[numeric_cols].copy()
    # Simplify the datetime index to a date string for the chart
    result.index = pd.to_datetime(result.index, utc=True).strftime("%Y-%m-%d")
    result.index.name = "date"
    result = result.reset_index()
    result = result.where(pd.notnull(result), None)
    return _sanitize(result.to_dict(orient="records"))


def get_last_backtest_position() -> Optional[dict]:
    """
    Infers whether the strategy held an open position at the end of the most
    recent backtest by walking the filled orders in the trades CSV.
    Returns a position-shaped dict (same schema as Alpaca positions), or None.
    """
    path = _latest_file("_trades.csv")
    if path is None:
        return None
    try:
        df = pd.read_csv(path)
        fills = df[df["status"] == "fill"].copy()
        if fills.empty:
            return None

        fills = fills.sort_values("time")
        buys  = fills[fills["side"] == "buy"]
        sells = fills[fills["side"] == "sell"]

        if buys.empty:
            return None

        last_buy = buys.iloc[-1]
        last_buy_time = str(last_buy["time"])

        # A sell after the last buy means the position was closed
        sells_after = sells[sells["time"].astype(str) > last_buy_time]
        if not sells_after.empty:
            return None

        qty = float(last_buy["filled_quantity"]) if pd.notna(last_buy.get("filled_quantity")) else 0.0
        price = float(last_buy["price"]) if pd.notna(last_buy.get("price")) else None
        return {
            "symbol": str(last_buy.get("symbol", "?")),
            "qty": qty,
            "side": "long",
            "avg_entry_price": price,
            "current_price": None,
            "market_value": round(qty * price, 2) if price else None,
            "unrealized_pl": None,
            "unrealized_plpc": None,
            "source": "backtest",
        }
    except Exception:
        return None


def get_last_symbol() -> str:
    """Return the symbol used in the most recent backtest (from learning_state or 'SPY')."""
    state = get_learning_state()
    if state and state.get("symbol"):
        return state["symbol"]
    return "SPY"


def get_learning_state() -> Optional[dict]:
    """Return the latest Q-table / learning state written by sarsa-v1.py."""
    path = os.path.join(_LOGS_DIR, "learning_state.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return None


def get_spy_series(start_value: float = 100_000) -> list[dict]:
    """
    Convert the most recent benchmark CSV (daily returns) into a
    cumulative portfolio series starting at start_value.
    Searches benchmark_{SYMBOL}_*.csv first, then legacy spy_benchmark_*.csv.
    """
    data_dir = os.path.join(_REPO_ROOT, "data")
    files = []
    for pattern in ["benchmark_*.csv", "spy_benchmark_*.csv"]:
        files = glob.glob(os.path.join(data_dir, pattern))
        if files:
            break
    if not files:
        return []
    path = max(files, key=os.path.getmtime)
    try:
        df = pd.read_csv(path, index_col=0)
        # The CSV stores daily % returns in a 'return' or first numeric column
        ret_col = "return" if "return" in df.columns else df.select_dtypes("number").columns[0]
        df = df[[ret_col]].dropna()
        df.index = pd.to_datetime(df.index, utc=True, errors="coerce").strftime("%Y-%m-%d")
        df = df[df.index != "NaT"]
        # Cumulative product from 1 (treat each row as 1 + daily_return)
        if df[ret_col].abs().max() > 1:
            # Already percentage — divide by 100
            df["cum"] = (1 + df[ret_col] / 100).cumprod() * start_value
        else:
            df["cum"] = (1 + df[ret_col]).cumprod() * start_value
        df.index.name = "date"
        df = df.reset_index()[["date", "cum"]].rename(columns={"cum": "portfolio_value"})
        return _sanitize(df.to_dict(orient="records"))
    except Exception:
        return []


def get_attribution() -> dict:
    """
    Derive trading attribution from trades CSV:
    action distribution (buy/sell counts) and win-rate.
    """
    path = _latest_file("_trades.csv")
    if path is None:
        return {}
    try:
        df = pd.read_csv(path)
        df = df[df["status"] == "fill"].copy()
        buy_count  = int((df["side"] == "buy").sum())
        sell_count = int((df["side"] == "sell").sum())
        total = buy_count + sell_count
        # Pair buys with subsequent sells to compute trade PnL
        buys  = df[df["side"] == "buy"]["price"].dropna().values
        sells = df[df["side"] == "sell"]["price"].dropna().values
        pairs = min(len(buys), len(sells))
        winning = sum(1 for i in range(pairs) if sells[i] > buys[i])
        return {
            "buy_count":  buy_count,
            "sell_count": sell_count,
            "hold_count": None,  # holds are not written to trades CSV
            "total_trades": total,
            "winning_trades": winning,
            "losing_trades": pairs - winning,
            "win_rate": round(winning / pairs * 100, 1) if pairs > 0 else None,
        }
    except Exception:
        return {}
