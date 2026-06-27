"""
GET  /analysis/report        — check LLM availability
POST /analysis/report        — stream full quantitative research report
POST /analysis/news-explain  — stream per-article market impact explanation

Supported providers (set LLM_PROVIDER in .env):
  anthropic  → ANTHROPIC_API_KEY   (Claude claude-sonnet-4-6)
  groq       → GROQ_API_KEY        (LLaMA 3.3 70B — free tier)
  openai     → OPENAI_API_KEY      (GPT-4o-mini)
  google     → GOOGLE_API_KEY      (Gemini 2.0 Flash — free tier)

Auto-detects whichever key is set first (groq → google → openai → anthropic).
"""
import os
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Any

from app.services import logs_reader

router = APIRouter()

# ─── Provider detection ───────────────────────────────────────────────────────

PROVIDER_MODELS = {
    "anthropic": "claude-sonnet-4-6",
    "groq":      "llama-3.3-70b-versatile",
    "openai":    "gpt-4o-mini",
    "google":    "gemini-2.0-flash",
}

# Groq free tier: 12k TPM total (prompt + output). Keep output small so total stays under limit.
# Other providers have generous limits.
PROVIDER_MAX_OUTPUT = {
    "anthropic": 10000,
    "groq":       3500,
    "openai":     8000,
    "google":     8000,
}

# Groq needs a compact prompt to stay under ~8k input tokens
PROVIDER_COMPACT_PROMPT = {
    "groq": True,
}

PROVIDER_LABELS = {
    "anthropic": "Claude claude-sonnet-4-6",
    "groq":      "LLaMA 3.3 70B (Groq)",
    "openai":    "GPT-4o-mini (OpenAI)",
    "google":    "Gemini 2.0 Flash (Google)",
}


def _detect_provider() -> tuple[str, str]:
    explicit = os.getenv("LLM_PROVIDER", "").strip().lower()
    if explicit in PROVIDER_MODELS:
        key = os.getenv({
            "anthropic": "ANTHROPIC_API_KEY",
            "groq":      "GROQ_API_KEY",
            "openai":    "OPENAI_API_KEY",
            "google":    "GOOGLE_API_KEY",
        }[explicit], "").strip()
        return explicit, key

    # Auto-detect — free providers first
    for provider, env_var in [
        ("groq",      "GROQ_API_KEY"),
        ("google",    "GOOGLE_API_KEY"),
        ("openai",    "OPENAI_API_KEY"),
        ("anthropic", "ANTHROPIC_API_KEY"),
    ]:
        key = os.getenv(env_var, "").strip()
        if key:
            return provider, key

    return "anthropic", ""


@router.get("/analysis/report")
def report_status():
    provider, key = _detect_provider()
    available = bool(key)
    return {
        "available": available,
        "provider":  provider if available else None,
        "label":     PROVIDER_LABELS.get(provider, provider) if available else None,
        "message": (
            f"AI reporting ready via {PROVIDER_LABELS.get(provider, provider)}."
            if available
            else (
                "No LLM API key found. Add one of: ANTHROPIC_API_KEY, GROQ_API_KEY, "
                "OPENAI_API_KEY, or GOOGLE_API_KEY to your .env file."
            )
        ),
    }


# ─── Request models ───────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    symbol:           str           = "SPY"
    start_date:       Optional[str] = None
    end_date:         Optional[str] = None
    extra_context:    Optional[str] = None
    attribution_data: Optional[Any] = None


class NewsExplainRequest(BaseModel):
    headline:    str
    sentiment:   str           = "neutral"   # positive / negative / neutral
    probability: Optional[float] = None
    symbol:      str           = "SPY"
    source:      Optional[str] = None
    published:   Optional[str] = None


# ─── Data formatters ─────────────────────────────────────────────────────────

def _format_tearsheet(stats: dict, compact: bool = False) -> str:
    """Format the QuantStats tearsheet as a Strategy vs Benchmark table."""
    if not stats:
        return "  Backtest tearsheet not available."

    cols = list(stats.keys())
    if not cols:
        return "  Empty tearsheet."

    strategy_col = "Strategy" if "Strategy" in cols else cols[0]
    bench_col    = next((c for c in cols if c != strategy_col), None)

    lines = []
    if bench_col:
        lines.append(f"  {'Metric':<30}  {'Strategy':>12}  {'Benchmark (' + bench_col + ')':>16}")
        lines.append("  " + "─" * 64)
    else:
        lines.append(f"  {'Metric':<30}  {'Strategy':>12}")
        lines.append("  " + "─" * 45)

    # Compact mode: only the most critical metrics to keep prompt small
    if compact:
        priority_order = [
            "Total Return", "CAGR", "Sharpe", "Sortino",
            "Max Drawdown", "Volatility", "Win Days%",
            "Best Year", "Worst Year", "YTD", "1Y",
            "Corr to Benchmark", "Time in Market",
        ]
    else:
        priority_order = [
            "Total Return", "CAGR", "Sharpe", "Sortino", "Calmar",
            "Max Drawdown", "Volatility", "Longest DD Days",
            "Win Days%", "Best Year", "Worst Year",
            "Expected Daily%", "Expected Monthly%", "Expected Yearly%",
            "Daily Value-at-Risk", "Corr to Benchmark",
            "1Y", "3Y (ann.)", "5Y (ann.)", "YTD",
            "Best Day", "Worst Day", "Avg. Drawdown", "Recovery Factor",
            "Time in Market",
        ]

    metric_rows = list(stats.get(strategy_col, {}).items())
    # Re-order by priority
    ordered = []
    seen = set()
    for pkey in priority_order:
        for metric, val in metric_rows:
            if pkey.lower() in str(metric).lower() and metric not in seen:
                ordered.append((metric, val))
                seen.add(metric)
    for metric, val in metric_rows:
        if metric not in seen:
            ordered.append((metric, val))
            seen.add(metric)

    for metric, strat_val in ordered:
        if not metric or str(metric).strip() == "nan":
            continue
        strat_str = str(strat_val) if strat_val is not None else "N/A"
        if bench_col:
            bench_val = stats.get(bench_col, {}).get(metric, "")
            bench_str = str(bench_val) if bench_val is not None else ""
            lines.append(f"  {str(metric):<30}  {strat_str:>12}  {bench_str:>16}")
        else:
            lines.append(f"  {str(metric):<30}  {strat_str:>12}")

    return "\n".join(lines)


def _format_qtable(qtable: dict) -> str:
    if not qtable:
        return "  Not available"
    lines = []
    for state, actions in qtable.items():
        if not actions:
            continue
        best = max(actions, key=lambda a: actions.get(a, 0))
        vals = ", ".join(f"{a}={actions.get(a, 0):.4f}" for a in ["buy", "sell", "hold"])
        margin = actions.get(best, 0) - sorted(actions.values(), reverse=True)[1] if len(actions) > 1 else 0
        lines.append(
            f"  {state:<18}  [{vals}]  "
            f"→ LEARNED: {best.upper()} (margin: {margin:+.4f})"
        )
    return "\n".join(lines)


def _format_recent_decisions(decisions: list, limit: int = 20) -> str:
    if not decisions:
        return "  No recent decisions available."
    lines = []
    for d in decisions[-limit:]:
        lines.append(
            f"  {d.get('date','?')}  state={d.get('state','?'):<18}  "
            f"sentiment={d.get('sentiment','?'):<8}  trend={d.get('trend','?'):<4}  "
            f"action={d.get('action','?'):<4}  prob={d.get('probability',0):.2f}  "
            f"reward={d.get('reward',0):+.3f}  "
            f"portfolio=${d.get('portfolio_value',0):,.0f}"
        )
    return "\n".join(lines)


def _format_trades(trades: list, limit: int = 15) -> str:
    if not trades:
        return "  No trades available"
    lines = []
    for t in trades[-limit:]:
        parts = []
        for k in ["time", "symbol", "side", "price", "filled_quantity", "status", "trade_pnl"]:
            v = t.get(k)
            if v is not None:
                parts.append(f"{k}: {v}")
        if parts:
            lines.append("  " + "  |  ".join(parts))
    return "\n".join(lines)


def _format_trade_stats(attr: dict) -> str:
    if not attr:
        return "  Not available"
    return (
        f"  Total fills:    {attr.get('total_trades', 'N/A')}\n"
        f"  Buy orders:     {attr.get('buy_count', 'N/A')}\n"
        f"  Sell orders:    {attr.get('sell_count', 'N/A')}\n"
        f"  Winning trades: {attr.get('winning_trades', 'N/A')}\n"
        f"  Losing trades:  {attr.get('losing_trades', 'N/A')}\n"
        f"  Win rate:       {attr.get('win_rate', 'N/A')}%"
    )


def _format_attribution(attr: dict) -> str:
    if not attr:
        return "  Not available — run attribution analysis from the Research Report page first."

    lines = []
    cats  = attr.get("categories", [])
    total = attr.get("total_articles", 0)

    if cats:
        lines.append(f"  Based on {total} news articles classified into 14 categories ({attr.get('period', '')}):")
        lines.append(f"  News source: Alpaca Markets feed (Benzinga + Reuters syndication).")
        lines.append(f"  Premium feeds (Bloomberg Terminal, FactSet, RavenPack) available via integration.")
        lines.append(f"")
        lines.append(f"  {'Category':<22} {'Count':>6}  {'Avg T+1 Return':>14}  {'Avg T+5 Return':>14}")
        lines.append("  " + "─" * 62)
        for c in cats:
            if c["article_count"] == 0:
                continue
            t1 = f"{c['avg_return_1d']:+.3f}%"
            t5 = f"{c['avg_return_5d']:+.3f}%"
            lines.append(f"  {c['category']:<22} {c['article_count']:>6}  {t1:>14}  {t5:>14}")

    extremes = attr.get("extreme_events", {})
    if extremes:
        pos = extremes.get("largest_positive")
        neg = extremes.get("largest_negative")
        if pos:
            lines.append(f"\n  LARGEST POSITIVE EVENT ({pos['date']}):")
            lines.append(f"    Headline: {pos['headline']}")
            lines.append(f"    5-day return: +{pos['return_5d']}%")
            lines.append(f"    Source: {pos.get('source', 'Alpaca/Benzinga')}")
        if neg:
            lines.append(f"\n  LARGEST NEGATIVE EVENT ({neg['date']}):")
            lines.append(f"    Headline: {neg['headline']}")
            lines.append(f"    5-day return: {neg['return_5d']}%")
            lines.append(f"    Source: {neg.get('source', 'Alpaca/Benzinga')}")

    lag_section = attr.get("lag", [])
    if lag_section:
        lines.append("\n  SENTIMENT LAG ANALYSIS (how long does news effect persist?):")
        lines.append(f"  {'Lag':>6}  {'Pos News Avg':>12}  {'Neg News Avg':>12}  {'Divergence':>12}  {'Pos N':>6}  {'Neg N':>6}")
        lines.append("  " + "─" * 62)
        for row in lag_section:
            div = row["avg_positive_return"] - row["avg_negative_return"]
            lines.append(
                f"  T+{row['lag']:2d}d   "
                f"{row['avg_positive_return']:>+11.3f}%"
                f"  {row['avg_negative_return']:>+11.3f}%"
                f"  {div:>+11.3f}%"
                f"  {row.get('positive_n', 0):>6}"
                f"  {row.get('negative_n', 0):>6}"
            )
        peak = attr.get("peak_lag")
        if peak:
            lines.append(f"\n  Peak sentiment divergence: T+{peak} trading days")

    return "\n".join(lines) if lines else "  No attribution data available."


# ─── Prompt builders ──────────────────────────────────────────────────────────

def _build_report_prompt(req: ReportRequest, stats, trades, learning, trade_attr, provider: str) -> str:
    compact = PROVIDER_COMPACT_PROMPT.get(provider, False)
    return _build_report_prompt_inner(req, stats, trades, learning, trade_attr, provider, compact)


def _build_report_prompt_inner(req, stats, trades, learning, trade_attr, provider, compact: bool) -> str:
    qtable       = learning.get("q_table", {})           if learning else {}
    act_counts   = learning.get("action_counts", {})     if learning else {}
    sent_counts  = learning.get("sentiment_counts", {})  if learning else {}
    recent_decs  = learning.get("recent_decisions", [])  if learning else []
    iteration    = learning.get("iteration", "unknown")  if learning else "unknown"
    epsilon      = learning.get("epsilon", "unknown")    if learning else "unknown"
    pf_value     = learning.get("portfolio_value", None) if learning else None
    # Use symbol from learning state if available (reflects actual backtest)
    actual_symbol = learning.get("symbol", req.symbol)  if learning else req.symbol

    total_a  = sum(act_counts.values()) or 1
    act_str  = ", ".join(f"{k}: {v} ({v/total_a*100:.1f}%)" for k, v in act_counts.items()) or "unavailable"
    total_s  = sum(sent_counts.values()) or 1
    sent_str = ", ".join(f"{k}: {v} ({v/total_s*100:.1f}%)" for k, v in sent_counts.items()) or "unavailable"

    period        = f"{req.start_date or 'N/A'} → {req.end_date or 'N/A'}"
    extra         = f"\n\nAdditional context from analyst:\n{req.extra_context}" if req.extra_context else ""
    attr_block    = _format_attribution(req.attribution_data or {})
    model_label   = PROVIDER_LABELS.get(provider, provider)
    pf_str        = f"${pf_value:,.2f}" if pf_value else "N/A"

    # Compact mode: trim data to stay under Groq's 12k TPM limit
    dec_limit    = 8  if compact else 20
    trade_limit  = 8  if compact else 15

    if compact:
        return _compact_report_prompt(
            req, stats, trades, learning, trade_attr, provider,
            actual_symbol, period, pf_str, model_label,
            qtable, act_counts, sent_counts, recent_decs, iteration, epsilon,
            total_a, act_str, sent_str, attr_block, extra,
            dec_limit, trade_limit, trade_attr,
        )

    hold_pct = act_counts.get('hold', 0) / total_a * 100
    sell_pct = act_counts.get('sell', 0) / total_a * 100
    buy_pct  = act_counts.get('buy',  0) / total_a * 100

    return f"""You are QuantSentinel AI, an institutional-grade quantitative research analyst and financial intelligence system. Your task is to generate a report comparable to what a quantitative research team at a hedge fund, asset manager, investment bank, or institutional research firm would produce.

PRIMARY OBJECTIVE: Do NOT summarize the backtest. Instead, perform a deep quantitative investigation into why the strategy performed the way it did, how news influenced market behaviour, what the reinforcement learning agent actually learned, what market inefficiencies were discovered, which information sources created alpha, where the strategy succeeded and failed, and what future market scenarios are most likely.

WRITING STANDARD: Write professionally. Be analytical. Be objective. Never exaggerate results. Never claim the strategy is deployable or profitable unless the metrics clearly support that conclusion. Every conclusion must be justified by the supplied data. Whenever confidence is low, explicitly state the uncertainty. Do not invent statistics. If information is unavailable, clearly say so. Use financial terminology appropriate for institutional investors.

DATA INTEGRITY: Every statistic you cite must appear in the data block below. Do not round numbers unless explicitly noted. Do not fabricate metrics. If attribution data is absent, state so and reason from the performance data alone.

NEWS SOURCE: Alpaca Markets feed (Benzinga + Reuters syndication). Premium feeds — Bloomberg Terminal, FactSet, RavenPack — available via integration but not used in this analysis.

═══════════════════════════════════════════════════════════
  RESEARCH DATA — {actual_symbol}
═══════════════════════════════════════════════════════════

Asset:               {actual_symbol}
Analysis period:     {period}
Strategy:            SARSA Q-learning (α=0.1, γ=0.9, ε={epsilon}, cash_at_risk=50%)
Sentiment engine:    FinBERT (yiyanghkust/finbert-tone) — Alpaca news (Benzinga/Reuters)
Position rules:      Take-profit +20% | Stop-loss −5% | 50% cash at risk per trade
Training iterations: {iteration}
Final portfolio:     {pf_str}
Report engine:       {model_label}

─── BACKTEST TEARSHEET — Strategy vs Benchmark ─────────────────────────
{_format_tearsheet(stats)}

─── TRADE EXECUTION STATISTICS ────────────────────────────────────────
{_format_trade_stats(trade_attr)}

─── RECENT TRADE LOG (last 15 fills) ──────────────────────────────────
{_format_trades(trades)}

─── SARSA LEARNED Q-TABLE ─────────────────────────────────────────────
  States encode: sentiment (positive/negative/neutral) × market trend (bull/bear)
{_format_qtable(qtable)}

─── ACTION DISTRIBUTION (all {iteration} training iterations) ──────────
  {act_str}
  BUY: {buy_pct:.1f}% | HOLD: {hold_pct:.1f}% | SELL: {sell_pct:.1f}%

─── SENTIMENT DISTRIBUTION (news processed during backtest) ────────────
  {sent_str}

─── RECENT SARSA DECISIONS (last 20 trading days) ──────────────────────
{_format_recent_decisions(recent_decs)}

═══════════════════════════════════════════════════════════
  NEWS CATEGORY ATTRIBUTION & LAG ANALYSIS
  Source: Alpaca Markets (Benzinga/Reuters) — real price returns computed
═══════════════════════════════════════════════════════════

{attr_block}
{extra}

═══════════════════════════════════════════════════════════
  REPORT — write all 13 sections in full
═══════════════════════════════════════════════════════════

---

## 1. Executive Investment Thesis

Summarize the entire research in 2–4 paragraphs. Discuss overall performance relative to benchmark, risk-adjusted returns (Sharpe, Sortino, Calmar from the tearsheet), drawdown behaviour, portfolio characteristics, major strengths, major weaknesses, and investment implications.

Do NOT simply repeat metrics — interpret them. Answer: "What is the most important conclusion from this research?" Reference the actual numbers from the tearsheet. Be objective: if the strategy underperformed, say so and explain why.

---

## 2. Strategy Performance & Risk Diagnostics

Using the tearsheet data above, analyse: Total Return vs Benchmark, Alpha and Beta implied by the Corr to Benchmark figure, Sharpe, Sortino, Calmar, Maximum Drawdown, Volatility, Time in Market ({(stats or {}).get('Strategy', {}).get('Time in Market', 'see tearsheet')}), Win Days%, Best/Worst Year, Longest DD Days, and the trade execution statistics (win rate, buy/sell counts).

Discuss capital efficiency (are returns proportional to risk taken?), downside protection (how does max drawdown compare to benchmark?), consistency (Best vs Worst Year spread), opportunity cost of low market exposure, and whether the returns justify the risk. Do not simply list numbers — explain what they mean for a portfolio manager deciding whether to allocate capital.

---

## 3. Market Regime Analysis

Evaluate how {actual_symbol} behaved across different market environments during the backtest period. Use the Best Year ({(stats or {}).get('Strategy', {}).get('Best Year', 'N/A')}) vs Worst Year ({(stats or {}).get('Strategy', {}).get('Worst Year', 'N/A')}) data, the Longest DD Days, and YTD/1Y/3Y figures from the tearsheet to infer regime behaviour.

Identify where the SARSA strategy likely performed best (high-sentiment-signal environments, trending markets) and where it failed (low-information regimes, whipsaw markets). Explain why — reference the sentiment distribution ({sent_str}) and the HOLD dominance ({hold_pct:.1f}% of decisions) as evidence of strategy behaviour in different regimes. Discuss how macroeconomic shocks (rate cycles, inflation, geopolitical events) would have affected the FinBERT signal quality.

---

## 4. News Intelligence & Information Flow

Analyse how news flowed into {actual_symbol} prices during the backtest. Using the sentiment distribution ({sent_str}) and the attribution data, explain:

Which information moved the asset and which had little effect. How news volume and concentration affected signal quality — with {sent_counts.get('neutral', 0)} neutral classifications out of {total_s} total articles, assess whether the news environment was information-rich or information-sparse. Identify dominant topics from the attribution categories. Discuss which news produced immediate vs delayed reactions (reference lag data). Discuss information concentration risk: what happens when a single major news type dominates.

Note the difference between what Alpaca/Benzinga/Reuters captured and what institutional feeds (Bloomberg, FactSet, RavenPack) would additionally provide.

---

## 5. News Category Attribution

For every category in the attribution table above, provide: article count, average T+1 return, average T+5 return, and a substantive economic interpretation of why that category affects {actual_symbol}.

Highlight the most influential categories (highest absolute T+5 return), the weakest categories (near-zero average return), rare but powerful events (low count, high impact), and frequent but insignificant events (high count, near-zero return).

Reference the largest positive and negative events by their actual headline text and date from the attribution data. Discuss what these events reveal about market structure for {actual_symbol}. Note where coverage gaps in Alpaca/Benzinga news may have caused missed signals that Bloomberg or FactSet would have captured. Interpret — do not simply list numbers.

---

## 6. Explainable AI Decision Intelligence

Translate the SARSA reinforcement learning policy into language understandable by a portfolio manager who has never seen a Q-table.

Do NOT dump Q-values as a table. Instead explain in narrative form:

What the AI learned about {actual_symbol}: after {iteration} iterations across {len(qtable)} sentiment-trend state combinations, what pattern did the agent discover? The agent took BUY {buy_pct:.1f}% of the time, HOLD {hold_pct:.1f}%, and SELL {sell_pct:.1f}% — explain the economic meaning of this distribution.

For each sentiment-trend state in the Q-table, explain in one sentence why the learned action makes sense: what market condition does that state represent, and why would holding/buying/selling be rational in that environment?

Reference 2–3 specific rows from the recent decisions log to show the policy operating in real time. Explain the market inefficiency being exploited — what behavioural pattern in market participants does this strategy implicitly assume?

---

## 7. Behavioural Finance Insights

Analyse investor behaviour patterns revealed by the data. Using the attribution returns, sentiment distribution, and lag analysis, discuss:

Momentum persistence: does positive sentiment continue to drive returns at T+5 and T+10, or does it decay? Overreaction and underreaction: which news categories show immediate large reactions (T+1) that reverse by T+5, and which show delayed absorption? Fear vs greed asymmetry: compare positive-sentiment lag returns vs negative-sentiment lag returns — is fear or greed more persistent for {actual_symbol}?

Earnings reactions, analyst influence, and macroeconomic sensitivity as revealed by the attribution categories. News decay: at which lag does the sentiment signal become noise? What does this reveal about the information efficiency of the {actual_symbol} market?

---

## 8. Market Structure & Drivers

Determine which factors explain the majority of {actual_symbol}'s movement during the backtest period. Using the attribution data, rank the news categories by their T+5 return magnitude and article volume.

Estimate which macro and micro drivers were historically most important for this asset. Explain why each top driver affects prices — the economic transmission mechanism (e.g., how does Federal Reserve news affect {actual_symbol} through interest rate sensitivity, discount rate changes, or credit conditions?). Identify any surprising findings: categories with high article volume but low return impact, or categories with few articles but outsized returns. Discuss sector rotation dynamics, factor exposure (growth vs value), and how {actual_symbol}'s sensitivity to news categories compares to what you would expect from first principles.

---

## 9. Counterfactual Analysis

Reason analytically about alternative scenarios. Using the attribution data and Q-table, consider:

If the highest-impact news category had been absent from the training data, how might the Q-table policy have differed? If the strategy had been deployed during the best-performing year vs the worst year, what would the outcome have been (use Best Year and Worst Year data from the tearsheet)?

If the news source had been Bloomberg instead of Benzinga/Reuters, what additional signal coverage might have changed the sentiment distribution? If the SARSA epsilon had been set to 0 (pure exploitation, no exploration), what would the policy have looked like given the current Q-values?

Clearly identify these as analytical counterfactuals derived from the data, not measured experiments. Estimate the directional impact of each scenario.

---

## 10. Forecast Scenario Engine

Do NOT predict exact prices. Produce probability-based scenarios grounded in the attribution data and current market regime (reference the most recent decisions log).

**Bull Case:** Probability, key catalysts drawn from top positive-attribution news categories, expected return range justified by historical T+5 returns for those categories, major risks, supporting evidence.

**Base Case:** Probability, expected range, key assumptions, supporting evidence from the backtest tearsheet.

**Bear Case:** Probability, key catalysts drawn from top negative-attribution categories or from the largest negative event in the attribution data, expected range, supporting evidence.

State uncertainty explicitly. Do not fabricate probabilities — anchor them to historical base rates from the tearsheet where possible (e.g., the strategy was profitable in X out of Y years).

List the top 5 news categories that pose the greatest near-term risk or opportunity for {actual_symbol}, ranked by T+5 return magnitude from the attribution data.

---

## 11. Institutional Portfolio Implications

Discuss implications for each institutional client type — be specific to this strategy's actual characteristics (low market exposure at {(stats or {}).get('Strategy', {}).get('Time in Market', 'N/A')}, Corr to Benchmark at {(stats or {}).get('Strategy', {}).get('Corr to Benchmark', 'N/A')}, max drawdown at {(stats or {}).get('Strategy', {}).get('Max Drawdown', 'N/A')}):

Hedge funds: portfolio construction role (long/short overlay, alternative return stream), capacity constraints. Asset managers: how a low-correlation strategy changes portfolio-level Sharpe. Family offices: suitability given drawdown characteristics and return profile. Pension funds: liability-matching considerations given volatility and drawdown. Quant researchers: research value of the explainable RL framework. Risk managers: what monitoring infrastructure this strategy requires.

Avoid personalised investment advice. Focus on research implications.

---

## 12. Risk Assessment

Be transparent and specific to this system's actual limitations:

Model limitations: SARSA is a tabular RL method with only {len(qtable)} states — contrast with the actual complexity of market regimes. Overfitting risk: {iteration} iterations on a single asset; assess whether the Q-table policy is likely to generalise. Data limitations: Alpaca/Benzinga/Reuters coverage vs institutional-grade feeds; article count limitations (reference the total articles in the attribution data). News coverage bias: which types of {actual_symbol}-relevant events would Benzinga systematically undercover? Regime change risk: reference the Longest DD Days figure from the tearsheet as evidence of regime vulnerability. Execution risk: the backtest assumes no transaction costs, no slippage, and perfect fill — quantify the likely impact. State-space limitations: {len(qtable)} states vs the actual dimensionality of financial markets. FinBERT limitations: the model was trained on general financial text and may mislabel {actual_symbol}-specific jargon. Q-table non-persistence: the policy resets on each run, preventing long-term learning accumulation.

---

## 13. Future Research Opportunities

Recommend improvements, prioritised by expected research value. Ground each recommendation in a specific limitation identified in the data:

For each opportunity: what to build, why (cite the specific data-supported limitation it addresses), what improvement is plausible (directional only — do not fabricate percentage improvements), and which team would implement it.

Consider: deep RL (DQN, PPO) to handle continuous state spaces; transformer-based sentiment (FinGPT, BloombergGPT) to replace FinBERT; larger state spaces incorporating technical indicators (RSI, MACD) alongside sentiment; multi-asset learning to detect cross-asset sentiment propagation; SEC filing analysis for longer-horizon signals; options flow and implied volatility as regime indicators; alternative data (satellite imagery, credit card data) for leading indicators; adaptive epsilon scheduling to balance exploration and exploitation across market regimes; walk-forward validation to test out-of-sample robustness; integration with Bloomberg or FactSet for institutional-grade news coverage.

---

The report should read like it was written by a senior quantitative research analyst with expertise in reinforcement learning, financial NLP, market microstructure, behavioural finance, and explainable AI. Produce actionable market intelligence, not generic observations. Separate measured results from interpretations. Clearly distinguish facts, hypotheses, and analytical scenarios."""


def _compact_report_prompt(
    req, stats, trades, learning, trade_attr, provider,
    actual_symbol, period, pf_str, model_label,
    qtable, act_counts, sent_counts, recent_decs, iteration, epsilon,
    total_a, act_str, sent_str, attr_block, extra,
    dec_limit, trade_limit, trade_attr_dict,
) -> str:
    """Shorter prompt for Groq free tier (~8k tokens input so total stays under 12k TPM)."""
    hold_pct = act_counts.get('hold', 0) / total_a * 100
    sell_pct = act_counts.get('sell', 0) / total_a * 100
    buy_pct  = act_counts.get('buy',  0) / total_a * 100
    total_s  = sum(sent_counts.values()) or 1

    return f"""You are QuantSentinel AI, an institutional quantitative research analyst. Generate a professional research report for institutional clients (hedge funds, asset managers, family offices). Do NOT summarize data — investigate and interpret it.

RULES: Every statistic must come from the data below. Do not invent numbers. If data is absent, say so. Write analytically. Separate facts from hypotheses. Use institutional financial language.
NEWS SOURCE: Alpaca Markets (Benzinga + Reuters). Bloomberg/FactSet/RavenPack available via premium integration.

═══ RESEARCH DATA — {actual_symbol} ═══
Period: {period} | Strategy: SARSA (α=0.1, γ=0.9, ε={epsilon}) | Iterations: {iteration} | Final: {pf_str} | Engine: {model_label}

─── TEARSHEET (Strategy vs Benchmark) ───
{_format_tearsheet(stats, compact=True)}

─── TRADE STATISTICS ───
{_format_trade_stats(trade_attr_dict)}

─── Q-TABLE (sentiment × trend states) ───
{_format_qtable(qtable)}

─── ACTION DISTRIBUTION: BUY {buy_pct:.1f}% | HOLD {hold_pct:.1f}% | SELL {sell_pct:.1f}% ───
  {act_str}

─── SENTIMENT: {sent_str} ───

─── RECENT DECISIONS (last {dec_limit}) ───
{_format_recent_decisions(recent_decs, limit=dec_limit)}

─── RECENT TRADES (last {trade_limit}) ───
{_format_trades(trades, limit=trade_limit)}

═══ NEWS ATTRIBUTION ═══
{attr_block}
{extra}

Write all 13 sections below. Be concise but analytical. Cite exact data.

## 1. Executive Investment Thesis
2–3 paragraphs. Interpret (do not restate) the performance: what does the Sharpe, drawdown, and benchmark comparison actually mean? What is the single most important conclusion? Be objective — state weaknesses plainly.

## 2. Strategy Performance & Risk Diagnostics
Analyse key tearsheet metrics: return vs benchmark, Sharpe, Sortino, max drawdown, volatility, time in market, win rate. Discuss capital efficiency and whether returns justify the risk taken.

## 3. Market Regime Analysis
Infer from Best/Worst Year, Longest DD Days, and YTD/1Y where the strategy succeeds and fails. Which market regimes suit SARSA-FinBERT and which do not? Why?

## 4. News Intelligence & Information Flow
From the sentiment distribution ({sent_str}) and attribution data: which information moved {actual_symbol}? Which had little effect? What does the high neutral proportion ({sent_counts.get('neutral', 0)} of {total_s}) imply about signal scarcity?

## 5. News Category Attribution
For each category with data: article count, T+1 return, T+5 return, and the economic reason it affects {actual_symbol}. Identify the strongest signal, weakest signal, and most surprising finding. Reference the extreme events by headline and date.

## 6. Explainable AI Decision Intelligence
Translate the Q-table policy into portfolio manager language — no raw Q-values. Explain what the SARSA agent learned, why HOLD dominates at {hold_pct:.1f}%, why BUY is rare at {buy_pct:.1f}%, and what market inefficiency the policy implicitly exploits. Reference 2 rows from the decisions log as examples.

## 7. Behavioural Finance Insights
From the lag data and attribution returns: is there momentum persistence or mean reversion? Fear vs greed asymmetry? Which news types cause overreaction vs underreaction? At which lag does the sentiment signal decay to noise?

## 8. Market Structure & Drivers
Rank the attribution categories by T+5 impact. Which drivers dominate {actual_symbol}? Explain the economic transmission mechanism for the top 3. Identify any high-volume but low-impact categories (noise sources).

## 9. Counterfactual Analysis
Reason analytically: What if the highest-impact category had been excluded from training? What if the strategy ran in the best vs worst year from the tearsheet? What if Bloomberg feed replaced Benzinga? Label these as analytical scenarios, not measured facts.

## 10. Forecast Scenario Engine
Bull / Base / Bear — each with probability, catalyst from attribution data, expected return range, and supporting tearsheet evidence. Probabilities must sum to 100%. State uncertainty explicitly.

## 11. Institutional Portfolio Implications
For hedge funds, asset managers, family offices, pension funds, and quant researchers: what is the specific research or portfolio construction value of this strategy given its actual metrics (correlation, drawdown, time in market)?

## 12. Risk Assessment
Specific risks: {len(qtable)}-state space limitations, FinBERT coverage gaps, Benzinga vs Bloomberg bias, Q-table non-persistence, execution cost assumptions, regime change vulnerability (reference Longest DD Days), overfitting risk after {iteration} iterations on one asset.

## 13. Future Research Opportunities
5 prioritised improvements tied to specific limitations in the data. For each: what to build, why (cite the limitation), and what directional improvement is plausible. Do not fabricate improvement percentages.

Produce actionable intelligence. Separate facts from interpretations throughout."""


def _build_news_explain_prompt(req: NewsExplainRequest, learning: dict, trade_attr: dict) -> str:
    qtable      = learning.get("q_table", {})           if learning else {}
    act_counts  = learning.get("action_counts", {})     if learning else {}
    sent_counts = learning.get("sentiment_counts", {})  if learning else {}
    symbol      = learning.get("symbol", req.symbol)    if learning else req.symbol
    iteration   = learning.get("iteration", "unknown")  if learning else "unknown"

    # Find what SARSA does for this sentiment
    sentiment = req.sentiment.lower()
    states_for_sent = {s: v for s, v in qtable.items() if sentiment in s}
    sarsa_actions = {}
    for state, actions in states_for_sent.items():
        if actions:
            best = max(actions, key=lambda a: actions.get(a, 0))
            sarsa_actions[state] = (best, actions)

    sarsa_block = ""
    if sarsa_actions:
        sarsa_block = "\nSARSA learned responses for this sentiment:\n"
        for state, (best, actions) in sarsa_actions.items():
            vals = ", ".join(f"{a}={actions.get(a, 0):.4f}" for a in ["buy", "sell", "hold"])
            sarsa_block += f"  {state}: [{vals}] → LEARNED ACTION: {best.upper()}\n"
    else:
        sarsa_block = f"\nNo Q-table entries found for '{sentiment}' sentiment states."

    total_a   = sum(act_counts.values()) or 1
    hold_pct  = act_counts.get("hold", 0) / total_a * 100
    buy_pct   = act_counts.get("buy",  0) / total_a * 100
    sell_pct  = act_counts.get("sell", 0) / total_a * 100

    prob_str = f"{req.probability * 100:.0f}%" if req.probability else "N/A"
    source_str = req.source or "Alpaca/Benzinga/Reuters"

    return f"""You are a senior quantitative analyst at an AI research platform. A news headline has been classified by FinBERT and you must explain its market significance.

HEADLINE: "{req.headline}"
ASSET: {req.symbol} (actual backtest symbol: {symbol})
FinBERT CLASSIFICATION: {req.sentiment.upper()} (model confidence: {prob_str})
SOURCE: {source_str}
DATE: {req.published or "recent"}

SARSA SYSTEM CONTEXT (from {iteration} training iterations on {symbol}):
{sarsa_block}
Overall action distribution: BUY {buy_pct:.1f}% | HOLD {hold_pct:.1f}% | SELL {sell_pct:.1f}%
Sentiment seen during training: {", ".join(f"{k}: {v}" for k, v in sent_counts.items()) or "N/A"}

Write a concise but insightful 4-part analysis (use these exact headings):

## Market Interpretation
What does this headline actually mean for {req.symbol}? Explain the economic mechanism — who is affected, how capital flows respond to this type of news, and what institutional investors typically do when they see this headline.

## Likely Price Impact
Based on the FinBERT {req.sentiment} classification with {prob_str} confidence, what is the probable short-term price direction for {req.symbol}? Quantify where possible (e.g., "Fed rate surprises of this type have historically moved SPY ±0.5–1.5% intraday"). Explain why this specific news is {req.sentiment} for this asset.

## What the SARSA System Did
The FinBERT model classified this as {req.sentiment}. Based on the Q-table above, explain what action the SARSA system would likely take in response to this news, and why the learned policy responds this way. Reference the specific Q-values for the relevant state(s).

## What Traders Should Consider
3–4 concrete, actionable points:
- What could be done to capitalize on this news (if positive) or to protect against it (if negative)?
- What follow-up information should be monitored after this headline?
- What risk management consideration applies here?
- One specific improvement this suggests for the SARSA strategy.

Keep it sharp, specific, and grounded in the data provided. Avoid generic advice."""


# ─── Streaming adapters ───────────────────────────────────────────────────────

def _stream_anthropic(prompt: str, api_key: str, max_tokens: int = 10000):
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    with client.messages.stream(
        model=PROVIDER_MODELS["anthropic"],
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    ) as s:
        for text in s.text_stream:
            yield text


def _stream_openai_compat(prompt: str, api_key: str, base_url: str, model: str, max_tokens: int = 8000):
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=base_url)
    stream = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
        max_tokens=max_tokens,
    )
    for chunk in stream:
        text = chunk.choices[0].delta.content or ""
        if text:
            yield text


def _stream_google(prompt: str, api_key: str):
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(PROVIDER_MODELS["google"])
    response = model.generate_content(prompt, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text


def _get_text_stream(provider: str, api_key: str, prompt: str, max_tokens: int | None = None):
    # Use per-provider default if caller didn't specify
    out_tokens = max_tokens or PROVIDER_MAX_OUTPUT.get(provider, 8000)
    if provider == "anthropic":
        return _stream_anthropic(prompt, api_key, out_tokens)
    if provider == "groq":
        return _stream_openai_compat(prompt, api_key,
            base_url="https://api.groq.com/openai/v1",
            model=PROVIDER_MODELS["groq"], max_tokens=out_tokens)
    if provider == "openai":
        return _stream_openai_compat(prompt, api_key,
            base_url="https://api.openai.com/v1",
            model=PROVIDER_MODELS["openai"], max_tokens=out_tokens)
    if provider == "google":
        return _stream_google(prompt, api_key)
    raise ValueError(f"Unknown provider: {provider}")


def _make_sse_stream(text_iter):
    """Wrap a text iterator as SSE bytes."""
    def stream():
        try:
            for text in text_iter:
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
    return stream()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/analysis/report")
async def generate_report(body: ReportRequest = ReportRequest()):
    provider, api_key = _detect_provider()
    if not api_key:
        raise HTTPException(status_code=503, detail=(
            "No LLM API key found. Add one of the following to your .env file:\n"
            "  GROQ_API_KEY=gsk_...           (LLaMA 3.3 70B — FREE at console.groq.com)\n"
            "  GOOGLE_API_KEY=...             (Gemini 2.0 Flash — FREE at aistudio.google.com)\n"
            "  ANTHROPIC_API_KEY=sk-ant-...   (Claude — console.anthropic.com)\n"
            "  OPENAI_API_KEY=sk-...          (GPT-4o-mini — platform.openai.com)"
        ))

    stats      = logs_reader.get_stats()
    trades     = logs_reader.get_trades()
    learning   = logs_reader.get_learning_state()
    trade_attr = logs_reader.get_attribution()
    prompt     = _build_report_prompt(body, stats, trades, learning, trade_attr, provider)

    return StreamingResponse(
        _make_sse_stream(_get_text_stream(provider, api_key, prompt)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/analysis/news-explain")
async def explain_news(body: NewsExplainRequest):
    """Stream a 4-part market impact explanation for a single news headline."""
    provider, api_key = _detect_provider()
    if not api_key:
        raise HTTPException(status_code=503, detail="No LLM API key configured.")

    learning   = logs_reader.get_learning_state()
    trade_attr = logs_reader.get_attribution()
    prompt     = _build_news_explain_prompt(body, learning, trade_attr)
    # News explain is short — cap output to leave headroom on Groq free tier
    explain_tokens = min(PROVIDER_MAX_OUTPUT.get(provider, 8000), 1200)

    return StreamingResponse(
        _make_sse_stream(_get_text_stream(provider, api_key, prompt, max_tokens=explain_tokens)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
