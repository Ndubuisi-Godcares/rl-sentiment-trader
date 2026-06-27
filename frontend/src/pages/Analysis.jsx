import { useEffect, useState, useCallback } from "react";
import { fetchBacktest, fetchLearning } from "../services/api";
import { useTheme } from "../context/ThemeContext";
import Topbar from "../components/Topbar";

// ─── Data helpers ─────────────────────────────────────────────────────────────

function extractStat(stats, fragments) {
  if (!stats) return null;
  const col = Object.keys(stats)[0];
  if (!col) return null;
  const rows = stats[col];
  for (const frag of [].concat(fragments)) {
    const key = Object.keys(rows).find((k) => k.toLowerCase().includes(frag.toLowerCase()));
    if (key != null) return rows[key];
  }
  return null;
}

function parseNum(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[%,$,\s]/g, ""));
  return isNaN(n) ? null : n;
}

function pct(v, decimals = 2) {
  const n = parseNum(v);
  return n == null ? "--" : `${n >= 0 ? "+" : ""}${n.toFixed(decimals)}%`;
}

function num(v, decimals = 2) {
  const n = parseNum(v);
  return n == null ? "--" : n.toFixed(decimals);
}

// ─── Grading system ───────────────────────────────────────────────────────────

function grade(value, [a, b, c]) {
  if (value == null) return "?";
  if (value >= a) return "A";
  if (value >= b) return "B";
  if (value >= c) return "C";
  return "D";
}

function overallGrade(grades) {
  const map = { A: 4, B: 3, C: 2, D: 1 };
  const nums = grades.filter((g) => g && g !== "?").map((g) => map[g] ?? 0);
  if (!nums.length) return "?";
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  if (avg >= 3.5) return "A";
  if (avg >= 2.5) return "B";
  if (avg >= 1.5) return "C";
  return "D";
}

// CSS variable colours — work on any theme without !important hacks
const GRADE_COLOR = {
  A: "var(--c-positive)",
  B: "var(--c-positive)",
  C: "var(--c-warn)",
  D: "var(--c-negative)",
  "?": "var(--c-text3)",
};
const GRADE_BG = {
  A: "rgba(16,185,129,0.09)",
  B: "rgba(16,185,129,0.06)",
  C: "rgba(245,158,11,0.09)",
  D: "rgba(244,63,94,0.09)",
  "?": "rgba(100,116,139,0.07)",
};

function GradeBadge({ g, size = "sm" }) {
  const big = size === "lg";
  return (
    <span
      className={`font-black tabular-nums rounded-lg flex items-center justify-center ${big ? "w-16 h-16 text-3xl" : "w-8 h-8 text-base"}`}
      style={{ color: GRADE_COLOR[g], backgroundColor: GRADE_BG[g], border: "1px solid var(--c-border)" }}
    >
      {g}
    </span>
  );
}

// ─── Trade analysis ───────────────────────────────────────────────────────────

function analyzeTrades(trades) {
  if (!trades?.length) return null;
  const sample = trades[0];

  const pnlKey = Object.keys(sample).find((k) => {
    const lk = k.toLowerCase();
    return lk.includes("pnl") || lk.includes("profit") || lk.includes("net") || lk.includes("p&l");
  });
  const retKey = Object.keys(sample).find((k) => {
    const lk = k.toLowerCase();
    return (lk.includes("return") || lk.includes("pct") || lk.includes("percent")) && !lk.includes("date");
  });

  const key = pnlKey ?? retKey;
  const vals = key
    ? trades.map((t) => parseFloat(String(t[key]).replace(/[%$,]/g, ""))).filter((v) => !isNaN(v))
    : [];

  const wins   = vals.filter((v) => v > 0);
  const losses = vals.filter((v) => v < 0);
  const sumWin = wins.reduce((a, b) => a + b, 0);
  const sumLos = Math.abs(losses.reduce((a, b) => a + b, 0));

  return {
    total:        trades.length,
    wins:         wins.length,
    losses:       losses.length,
    winRate:      vals.length ? wins.length / vals.length : null,
    avgWin:       wins.length   ? sumWin / wins.length   : null,
    avgLoss:      losses.length ? sumLos / losses.length : null,
    profitFactor: sumLos > 0   ? sumWin / sumLos        : null,
    totalPnl:     vals.reduce((a, b) => a + b, 0),
    expectancy:   vals.length   ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
  };
}

// ─── Portfolio series analysis ────────────────────────────────────────────────

function analyzePortfolio(series) {
  if (!series?.length) return null;
  const vals = series
    .map((p) => parseFloat(p.value ?? p.portfolio_value ?? p.v ?? 0))
    .filter((v) => v > 0);
  if (vals.length < 2) return null;

  let peak = vals[0], maxDD = 0, ddStartIdx = 0, worstDDDays = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] > peak) { peak = vals[i]; ddStartIdx = i; }
    else {
      const dd = (vals[i] - peak) / peak;
      if (dd < maxDD) { maxDD = dd; worstDDDays = i - ddStartIdx; }
    }
  }

  const daily = [];
  for (let i = 1; i < vals.length; i++) daily.push((vals[i] - vals[i - 1]) / vals[i - 1]);
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const variance = daily.reduce((a, b) => a + (b - mean) ** 2, 0) / daily.length;
  const annualVol = Math.sqrt(variance) * Math.sqrt(252) * 100;

  const totalReturn = ((vals[vals.length - 1] - vals[0]) / vals[0]) * 100;
  const years = vals.length / 252;
  const cagr = (Math.pow(vals[vals.length - 1] / vals[0], 1 / Math.max(years, 0.01)) - 1) * 100;

  return { maxDD: maxDD * 100, worstDDDays, annualVol, totalReturn, cagr };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ step, title, subtitle, children }) {
  return (
    <div
      className="rounded-xl p-6 space-y-5"
      style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
    >
      <div className="flex items-start gap-4">
        {step && (
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: "var(--c-chip-bg)", color: "var(--c-accent)", border: "1px solid var(--c-border)" }}
          >
            {step}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function Row({ label, value, benchmark, context, color, pass }) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-800/50 last:border-0"
    >
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        {context && <p className="text-[10px] text-slate-600 mt-0.5">{context}</p>}
      </div>
      {benchmark && (
        <span className="text-[10px] text-slate-600 font-mono tabular-nums hidden sm:block">
          Benchmark: {benchmark}
        </span>
      )}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-sm font-bold tabular-nums font-mono"
          style={{ color: color ?? "var(--c-fallback)" }}
        >
          {value}
        </span>
        {pass != null && (
          <span
            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
            style={{
              color:           pass ? "#10b981" : "#f43f5e",
              backgroundColor: pass ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)",
            }}
          >
            {pass ? "PASS" : "FAIL"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Check item ───────────────────────────────────────────────────────────────

function Check({ pass, label, detail }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5">
        {pass === true  && <svg viewBox="0 0 20 20" fill="#10b981" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>}
        {pass === false && <svg viewBox="0 0 20 20" fill="#f43f5e" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>}
        {pass === null  && <svg viewBox="0 0 20 20" fill="#f59e0b" className="w-4 h-4"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-300">{label}</p>
        {detail && <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Analysis() {
  const [data,        setData]        = useState(null);
  const [learning,    setLearning]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error,       setError]       = useState(null);
  const { symbol = "SPY" }            = useTheme() ?? {};

  const load = useCallback(async () => {
    try {
      const [bt, lrn] = await Promise.all([fetchBacktest(), fetchLearning().catch(() => null)]);
      setData(bt);
      setLearning(lrn);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Cannot reach backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen text-slate-100">
        <Topbar title="Deep Analysis" lastUpdated={null} onRefresh={load} />
        <main className="pt-14 px-6 py-6 space-y-4 max-w-screen-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-800/40 animate-pulse" />
          ))}
        </main>
      </div>
    );
  }

  if (error || !data?.available) {
    return (
      <div className="min-h-screen text-slate-100">
        <Topbar title="Deep Analysis" lastUpdated={null} onRefresh={load} />
        <main className="pt-14 px-6 py-6 max-w-screen-xl">
          <div
            className="rounded-xl p-12 flex flex-col items-center gap-3 text-center"
            style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
          >
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-slate-700">
              <circle cx="20" cy="20" r="16" />
              <path d="M20 12v9M20 27v2" strokeLinecap="round" />
            </svg>
            <p className="text-sm font-semibold text-slate-400">No backtest results to analyze</p>
            <p className="text-xs text-slate-600 max-w-xs">
              Run a backtest on the Backtest page first, then return here for the full analysis.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Extract core metrics ───────────────────────────────────────────────────

  const stats    = data.stats;
  const trades   = data.trades ?? [];
  const series   = data.portfolio_series ?? [];
  const config   = data.config ?? {};
  const qtable   = learning?.state?.q_table ?? {};
  const actCounts = learning?.state?.action_counts ?? {};

  const rawSharpe  = parseNum(extractStat(stats, ["sharpe"]));
  const rawCagr    = parseNum(extractStat(stats, ["cagr"]));
  const rawReturn  = parseNum(extractStat(stats, ["total return", "cum. return", "cumulative"]));
  const rawDD      = parseNum(extractStat(stats, ["max drawdown"]));
  const rawSortino = parseNum(extractStat(stats, ["sortino"]));
  const rawCalmar  = parseNum(extractStat(stats, ["calmar"]));
  const rawVol     = parseNum(extractStat(stats, ["volatility", "annual vol"]));
  const rawWinRate = parseNum(extractStat(stats, ["win rate", "win%", "win ratio"]));

  const portfolioStats = analyzePortfolio(series);
  const tradeStats     = analyzeTrades(trades);

  // Prefer QuantStats values; fall back to computed
  const sharpe  = rawSharpe  ?? null;
  const cagr    = rawCagr    ?? portfolioStats?.cagr ?? null;
  const totalRet = rawReturn  ?? portfolioStats?.totalReturn ?? null;
  const maxDD   = rawDD      ?? portfolioStats?.maxDD ?? null;
  const vol     = rawVol     ?? portfolioStats?.annualVol ?? null;

  // ── Grades ────────────────────────────────────────────────────────────────

  const gReturn  = grade(cagr,   [15, 10, 7]);
  const gSharpe  = grade(sharpe, [1.0, 0.7, 0.5]);
  const gDD      = grade(maxDD != null ? -maxDD : null, [-10, -20, -30]); // drawdown is negative, so we invert
  // For drawdown: -5% DD → value is -5, -grade(−5, [−10, −20, −30]) → -5 >= -10 → A ✓
  const gDDFixed = grade(maxDD,  [-10, -20, -30]);  // maxDD is negative; -5 >= -10 passes A
  const overall  = overallGrade([gReturn, gSharpe, gDDFixed]);

  const sym    = config.symbol ?? symbol ?? "SPY";
  const period = config.start_date && config.end_date
    ? `${config.start_date} → ${config.end_date}`
    : "Unknown period";

  // ── Institutional thresholds ──────────────────────────────────────────────

  const checks = [
    {
      label:  "Positive risk-adjusted return (Sharpe > 0)",
      detail: sharpe != null ? `Sharpe: ${sharpe.toFixed(2)}` : "Sharpe unavailable",
      pass:   sharpe != null ? sharpe > 0 : null,
    },
    {
      label:  "Acceptable Sharpe ratio (≥ 0.5)",
      detail: "Institutional minimum for systematic strategies",
      pass:   sharpe != null ? sharpe >= 0.5 : null,
    },
    {
      label:  "Strong Sharpe ratio (≥ 1.0)",
      detail: "Target for quantitative funds",
      pass:   sharpe != null ? sharpe >= 1.0 : null,
    },
    {
      label:  "Positive CAGR above cash (> 5%)",
      detail: cagr != null ? `CAGR: ${cagr.toFixed(2)}%` : "CAGR unavailable",
      pass:   cagr != null ? cagr > 5 : null,
    },
    {
      label:  "Beats passive SPY CAGR (~9.3%)",
      detail: "Long-run S&P 500 average annual return",
      pass:   cagr != null ? cagr > 9.3 : null,
    },
    {
      label:  "Max drawdown within tolerance (< 25%)",
      detail: maxDD != null ? `Max DD: ${maxDD.toFixed(2)}%` : "DD unavailable",
      pass:   maxDD != null ? maxDD > -25 : null,
    },
    {
      label:  "Sufficient trade sample size (≥ 20 trades)",
      detail: `${trades.length} total trades recorded`,
      pass:   trades.length >= 20,
    },
    {
      label:  "Positive trade expectancy",
      detail: tradeStats?.expectancy != null
        ? `Avg P&L per trade: ${tradeStats.expectancy.toFixed(2)}`
        : "No P&L data in trade log",
      pass:   tradeStats?.expectancy != null ? tradeStats.expectancy > 0 : null,
    },
  ];

  const passed = checks.filter((c) => c.pass === true).length;
  const total  = checks.filter((c) => c.pass !== null).length;

  // ── Sentiment-action intelligence ─────────────────────────────────────────

  const qtableStates = Object.keys(qtable);
  const Q_ACTIONS    = ["buy", "sell", "hold"];

  // Best action per sentiment state
  const bestActions = qtableStates.map((state) => {
    const vals    = Q_ACTIONS.map((a) => ({ action: a, q: qtable[state]?.[a] ?? 0 }));
    const best    = vals.reduce((a, b) => (b.q > a.q ? b : a), vals[0]);
    return { state, best: best?.action, q: best?.q };
  });

  // ── Recommendations ───────────────────────────────────────────────────────

  const recommendations = [];
  if (sharpe != null && sharpe < 1.0) {
    recommendations.push({
      priority: "HIGH",
      title:    "Improve Sharpe ratio",
      detail:   `Current ${sharpe.toFixed(2)} is below the 1.0 institutional target. Consider tighter stop-losses or adding a trend filter to reduce noise trades.`,
      color:    "#f59e0b",
    });
  }
  if (maxDD != null && maxDD < -20) {
    recommendations.push({
      priority: "HIGH",
      title:    "Reduce maximum drawdown",
      detail:   `${maxDD.toFixed(1)}% drawdown exceeds the -20% threshold. Consider reducing cash_at_risk from 0.5 or adding a circuit-breaker for consecutive losses.`,
      color:    "#f43f5e",
    });
  }
  if (tradeStats && tradeStats.winRate != null && tradeStats.winRate < 0.4) {
    recommendations.push({
      priority: "MEDIUM",
      title:    "Low win rate — verify profit factor",
      detail:   `Win rate of ${(tradeStats.winRate * 100).toFixed(0)}% is below 40%. Acceptable only if average wins significantly outsize average losses (profit factor > 1.5).`,
      color:    "#f59e0b",
    });
  }
  if (cagr != null && cagr > 9.3) {
    recommendations.push({
      priority: "INFO",
      title:    "Alpha confirmed — validate out-of-sample",
      detail:   `CAGR of ${cagr.toFixed(1)}% beats the SPY baseline. Run Walk-Forward validation on the Backtest page to check if the edge persists on unseen data.`,
      color:    "#10b981",
    });
  }
  if (trades.length < 30) {
    recommendations.push({
      priority: "MEDIUM",
      title:    "Small trade sample — extend backtest window",
      detail:   `${trades.length} trades may not be statistically significant. A longer date range or additional symbols would give more confidence.`,
      color:    "#6366f1",
    });
  }
  recommendations.push({
    priority: "INFO",
    title:    "Persist Q-table across sessions",
    detail:   "The learned policy resets on each run. Saving the Q-table to disk would allow incremental learning and faster convergence in future runs.",
    color:    "#6366f1",
  });

  const PRI_COLOR = { HIGH: "#f43f5e", MEDIUM: "#f59e0b", INFO: "#6366f1" };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title="Deep Analysis" lastUpdated={lastUpdated} onRefresh={load} />

      <main className="pt-14 px-6 py-6 space-y-6 max-w-screen-xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
              SARSA · FinBERT Sentiment Strategy
            </p>
            <h2 className="text-lg font-bold text-slate-100">Deep Financial Analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {sym} · {period} · Logical sequence evaluation
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold mb-1">Overall Grade</p>
              <GradeBadge g={overall} size="lg" />
            </div>
          </div>
        </div>

        {/* ── Step 1: Strategy Snapshot ── */}
        <Section
          step="1"
          title="Strategy Snapshot"
          subtitle="What we are analyzing and how the system makes decisions"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Symbol",    value: sym,                       color: "var(--c-accent)" },
              { label: "Method",    value: "SARSA ε-greedy",          color: "#94a3b8" },
              { label: "Sentiment", value: "FinBERT (Financial BERT)", color: "#94a3b8" },
              { label: "Trades",    value: `${trades.length} total`,  color: "#94a3b8" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-lg px-3 py-3"
                style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border-s)" }}
              >
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-1">{label}</p>
                <p className="text-sm font-bold" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Every trading day the strategy fetches recent news headlines for <strong className="text-slate-300">{sym}</strong> from
            Alpaca's news API, passes them through FinBERT to classify sentiment as{" "}
            <span className="text-emerald-400 font-medium">positive</span>,{" "}
            <span className="text-red-400 font-medium">negative</span>, or{" "}
            <span className="text-slate-400 font-medium">neutral</span>,
            then uses the trained Q-table to pick the highest-value action for that sentiment state.
            Rewards are computed from bracket order outcomes and fed back into SARSA updates.
          </p>
        </Section>

        {/* ── Step 2: Performance Grading ── */}
        <Section
          step="2"
          title="Performance Grading"
          subtitle="Four dimensions graded against institutional benchmarks"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Return (CAGR)",
                value: cagr != null ? `${cagr.toFixed(1)}%` : "--",
                sub:   "≥15% A · ≥10% B · ≥7% C",
                g:     gReturn,
                color: cagr != null && cagr > 0 ? "#10b981" : "#f43f5e",
              },
              {
                label: "Risk (Sharpe)",
                value: sharpe != null ? sharpe.toFixed(2) : "--",
                sub:   "≥1.0 A · ≥0.7 B · ≥0.5 C",
                g:     gSharpe,
                color: "var(--c-accent)",
              },
              {
                label: "Drawdown",
                value: maxDD != null ? `${maxDD.toFixed(1)}%` : "--",
                sub:   ">-10% A · >-20% B · >-30% C",
                g:     gDDFixed,
                color: maxDD != null && maxDD > -20 ? "#f59e0b" : "#f43f5e",
              },
              {
                label: "Sortino",
                value: rawSortino != null ? rawSortino.toFixed(2) : "--",
                sub:   "Downside-adjusted return",
                g:     grade(rawSortino, [1.5, 1.0, 0.7]),
                color: "var(--c-positive)",
              },
            ].map(({ label, value, sub, g, color }) => (
              <div
                key={label}
                className="rounded-lg px-4 py-4 flex flex-col gap-3"
                style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border-s)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{label}</p>
                  <GradeBadge g={g} />
                </div>
                <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[10px] text-slate-600">{sub}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Step 3: Risk-Return Benchmark ── */}
        <Section
          step="3"
          title="Benchmark Comparison"
          subtitle="How the strategy compares to market standards"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  {["Metric", "This Strategy", "Passive SPY", "Avg Hedge Fund", "Institutional Target"].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "CAGR",
                    ours:  cagr != null ? `${cagr.toFixed(1)}%` : "--",
                    spy:   "~9.3%", hf: "~8–12%", target: "> 12%",
                    oursNum: cagr, targetNum: 12,
                  },
                  {
                    label: "Sharpe Ratio",
                    ours:  sharpe != null ? sharpe.toFixed(2) : "--",
                    spy:   "~0.41", hf: "~0.5–1.0", target: "> 1.0",
                    oursNum: sharpe, targetNum: 1.0,
                  },
                  {
                    label: "Max Drawdown",
                    ours:  maxDD != null ? `${maxDD.toFixed(1)}%` : "--",
                    spy:   "~-33.7%", hf: "~-15 to -25%", target: "< -20%",
                    oursNum: maxDD, targetNum: -20, invert: true,
                  },
                  {
                    label: "Sortino Ratio",
                    ours:  rawSortino != null ? rawSortino.toFixed(2) : "--",
                    spy:   "~0.5", hf: "~0.7–1.2", target: "> 1.0",
                    oursNum: rawSortino, targetNum: 1.0,
                  },
                  {
                    label: "Calmar Ratio",
                    ours:  rawCalmar != null ? rawCalmar.toFixed(2) : "--",
                    spy:   "~0.28", hf: "~0.3–0.7", target: "> 0.5",
                    oursNum: rawCalmar, targetNum: 0.5,
                  },
                ].map(({ label, ours, spy, hf, target, oursNum, targetNum, invert }) => {
                  const beats = oursNum != null && targetNum != null
                    ? invert ? oursNum >= targetNum : oursNum >= targetNum
                    : null;
                  return (
                    <tr key={label} className="border-b border-slate-800/40 last:border-0">
                      <td className="py-2.5 pr-4 text-slate-400 font-medium">{label}</td>
                      <td className="py-2.5 pr-4 font-mono font-bold tabular-nums"
                          style={{ color: beats === true ? "var(--c-positive)" : beats === false ? "var(--c-negative)" : "var(--c-fallback)" }}>
                        {ours}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500 font-mono">{spy}</td>
                      <td className="py-2.5 pr-4 text-slate-500 font-mono">{hf}</td>
                      <td className="py-2.5 text-slate-500 font-mono">{target}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-600">
            Green values beat or meet the institutional target. Red values fall short.
            SPY and hedge-fund figures are long-run averages and will vary by period.
          </p>
        </Section>

        {/* ── Step 4: Drawdown & Risk Analysis ── */}
        <Section
          step="4"
          title="Drawdown & Risk Analysis"
          subtitle="Capital preservation and downside risk assessment"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: "Max Drawdown",
                value: maxDD != null ? `${maxDD.toFixed(2)}%` : "--",
                context: maxDD != null
                  ? maxDD > -10 ? "Excellent capital preservation"
                  : maxDD > -20 ? "Acceptable — within institutional norms"
                  : maxDD > -30 ? "Elevated — review position sizing"
                  : "High — significant risk to capital"
                  : "No data",
                color: maxDD != null
                  ? maxDD > -10 ? "#10b981" : maxDD > -20 ? "var(--c-positive)" : maxDD > -30 ? "#f59e0b" : "#f43f5e"
                  : "#64748b",
              },
              {
                label: "Annual Volatility",
                value: vol != null ? `${vol.toFixed(1)}%` : "--",
                context: vol != null
                  ? vol < 10  ? "Low — below SPY volatility"
                  : vol < 20  ? "Moderate — comparable to broad market"
                  : vol < 30  ? "Elevated — above typical equity volatility"
                  : "High — significant price swings"
                  : "Computed from equity curve",
                color: vol != null
                  ? vol < 10 ? "#10b981" : vol < 20 ? "var(--c-positive)" : vol < 30 ? "#f59e0b" : "#f43f5e"
                  : "#64748b",
              },
              {
                label: "Calmar Ratio",
                value: rawCalmar != null ? rawCalmar.toFixed(2) : "--",
                context: rawCalmar != null
                  ? rawCalmar > 1.0 ? "Strong — high return per drawdown unit"
                  : rawCalmar > 0.5 ? "Acceptable for systematic strategies"
                  : "Low — drawdown too large relative to return"
                  : "CAGR ÷ Max Drawdown",
                color: rawCalmar != null
                  ? rawCalmar > 1.0 ? "#10b981" : rawCalmar > 0.5 ? "#f59e0b" : "#f43f5e"
                  : "#64748b",
              },
            ].map(({ label, value, context, color }) => (
              <div
                key={label}
                className="rounded-lg px-4 py-4 space-y-2"
                style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border-s)" }}
              >
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{label}</p>
                <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
                <p className="text-[11px] text-slate-500">{context}</p>
              </div>
            ))}
          </div>
          <Row
            label="Risk classification"
            value={
              maxDD == null ? "Unknown"
              : maxDD > -10  ? "Conservative"
              : maxDD > -20  ? "Moderate"
              : maxDD > -30  ? "Aggressive"
              : "Speculative"
            }
            context="Based on max drawdown depth relative to institutional risk tiers"
            color={
              maxDD == null ? "#64748b"
              : maxDD > -10  ? "#10b981"
              : maxDD > -20  ? "var(--c-positive)"
              : maxDD > -30  ? "#f59e0b"
              : "#f43f5e"
            }
          />
        </Section>

        {/* ── Step 5: Trade Quality ── */}
        <Section
          step="5"
          title="Trade Quality Analysis"
          subtitle="Efficiency and statistical reliability of individual trade decisions"
        >
          {tradeStats ? (
            <div className="space-y-0">
              <Row
                label="Win rate"
                value={tradeStats.winRate != null ? `${(tradeStats.winRate * 100).toFixed(1)}%` : "--"}
                benchmark="≥ 40% acceptable with positive profit factor"
                context={`${tradeStats.wins} winning · ${tradeStats.losses} losing trades`}
                color={
                  tradeStats.winRate == null ? "#64748b"
                  : tradeStats.winRate >= 0.55 ? "#10b981"
                  : tradeStats.winRate >= 0.40 ? "var(--c-positive)"
                  : "#f59e0b"
                }
                pass={tradeStats.winRate != null ? tradeStats.winRate >= 0.40 : null}
              />
              <Row
                label="Profit factor"
                value={tradeStats.profitFactor != null ? tradeStats.profitFactor.toFixed(2) : "--"}
                benchmark="≥ 1.5 target · ≥ 1.0 break-even"
                context="Total gross profit ÷ total gross loss"
                color={
                  tradeStats.profitFactor == null ? "#64748b"
                  : tradeStats.profitFactor >= 1.5 ? "#10b981"
                  : tradeStats.profitFactor >= 1.0 ? "var(--c-positive)"
                  : "#f43f5e"
                }
                pass={tradeStats.profitFactor != null ? tradeStats.profitFactor >= 1.0 : null}
              />
              <Row
                label="Average win"
                value={tradeStats.avgWin != null ? tradeStats.avgWin.toFixed(2) : "--"}
                context="Mean gain on profitable trades"
                color="#10b981"
              />
              <Row
                label="Average loss"
                value={tradeStats.avgLoss != null ? tradeStats.avgLoss.toFixed(2) : "--"}
                context="Mean loss on unprofitable trades"
                color="#f43f5e"
              />
              <Row
                label="Win / Loss ratio"
                value={
                  tradeStats.avgWin != null && tradeStats.avgLoss != null && tradeStats.avgLoss > 0
                    ? (tradeStats.avgWin / tradeStats.avgLoss).toFixed(2)
                    : "--"
                }
                benchmark="≥ 1.5 preferred"
                context="Average win size relative to average loss size"
                color="var(--c-accent)"
              />
              <Row
                label="Trade expectancy"
                value={tradeStats.expectancy != null ? tradeStats.expectancy.toFixed(2) : "--"}
                context="Expected value per trade — must be positive for long-term viability"
                color={tradeStats.expectancy != null && tradeStats.expectancy > 0 ? "#10b981" : "#f43f5e"}
                pass={tradeStats.expectancy != null ? tradeStats.expectancy > 0 : null}
              />
              <Row
                label="Total trades"
                value={tradeStats.total}
                context="Sample size — larger is more statistically reliable"
                color={tradeStats.total >= 30 ? "var(--c-positive)" : "#f59e0b"}
                pass={tradeStats.total >= 20}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">
              No trade-level P&L data available. Run a backtest that produces a trades log.
            </p>
          )}
        </Section>

        {/* ── Step 6: Sentiment Intelligence ── */}
        {qtableStates.length > 0 && (
          <Section
            step="6"
            title="Sentiment → Action Intelligence"
            subtitle="What the SARSA agent learned: which news sentiment leads to which action"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {["Sentiment State", "Best Action", "Buy Q", "Sell Q", "Hold Q", "Insight"].map((h) => (
                      <th
                        key={h}
                        className="text-left py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qtableStates.map((state) => {
                    const row    = qtable[state] ?? {};
                    const best   = Q_ACTIONS.reduce((a, b) => ((row[b] ?? 0) > (row[a] ?? 0) ? b : a), "hold");
                    const color  = { buy: "#10b981", sell: "#f43f5e", hold: "#94a3b8" }[best] ?? "#94a3b8";
                    const stColor = state.startsWith("pos") ? "#10b981" : state.startsWith("neg") ? "#f43f5e" : "#94a3b8";
                    const insight = {
                      positive: best === "buy"  ? `Positive news → BUY — agent learned ${sym} rises on good headlines`
                               : best === "sell" ? `Positive news → SELL — possible mean-reversion or overbought signal`
                               : `Positive news → HOLD — agent is cautious despite good sentiment`,
                      negative: best === "sell" ? `Negative news → SELL — agent learned to exit on bad headlines`
                               : best === "buy"  ? `Negative news → BUY — possible safe-haven or dip-buying behavior`
                               : `Negative news → HOLD — agent avoids both directions on fear`,
                      neutral:  best === "hold" ? `Neutral news → HOLD — no signal, agent sits on hands`
                               : `Neutral news → ${best.toUpperCase()} — agent found edge even in flat sentiment`,
                    };
                    const key = Object.keys(insight).find((k) => state.startsWith(k)) ?? "neutral";
                    return (
                      <tr key={state} className="border-b border-slate-800/40 last:border-0">
                        <td className="py-2.5 pr-4 font-semibold capitalize" style={{ color: stColor }}>
                          {state}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className="font-bold uppercase text-[10px] tracking-widest px-2 py-0.5 rounded"
                            style={{ color, backgroundColor: `${color}18` }}
                          >
                            {best}
                          </span>
                        </td>
                        {Q_ACTIONS.map((a) => (
                          <td key={a} className="py-2.5 pr-4 font-mono tabular-nums text-slate-400 text-[11px]">
                            {(row[a] ?? 0).toFixed(3)}
                          </td>
                        ))}
                        <td className="py-2.5 text-[10px] text-slate-500 max-w-xs">{insight[key]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {Object.keys(actCounts).length > 0 && (
              <div className="flex gap-6 pt-2">
                {Object.entries(actCounts).map(([action, count]) => {
                  const total = Object.values(actCounts).reduce((a, b) => a + b, 0);
                  const color = { buy: "#10b981", sell: "#f43f5e", hold: "#94a3b8" }[action] ?? "#94a3b8";
                  return (
                    <div key={action} className="text-center">
                      <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color }}>{action}</p>
                      <p className="text-lg font-black tabular-nums" style={{ color }}>
                        {total > 0 ? `${Math.round((count / total) * 100)}%` : "--"}
                      </p>
                      <p className="text-[10px] text-slate-600">{count} times</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}

        {/* ── Step 7: Industrial Viability Checklist ── */}
        <Section
          step={qtableStates.length > 0 ? "7" : "6"}
          title="Industrial Viability Assessment"
          subtitle="Logical pass/fail checklist against institutional deployment criteria"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checks.map((c, i) => (
              <Check key={i} pass={c.pass} label={c.label} detail={c.detail} />
            ))}
          </div>
          <div
            className="rounded-lg px-5 py-4 flex items-center gap-4"
            style={{
              backgroundColor: passed / total >= 0.75
                ? "rgba(16,185,129,0.08)"
                : passed / total >= 0.5
                ? "rgba(245,158,11,0.08)"
                : "rgba(244,63,94,0.08)",
              border: `1px solid ${
                passed / total >= 0.75
                  ? "rgba(16,185,129,0.2)"
                  : passed / total >= 0.5
                  ? "rgba(245,158,11,0.2)"
                  : "rgba(244,63,94,0.2)"
              }`,
            }}
          >
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-200">
                {passed} / {total} criteria met
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {passed / total >= 0.75
                  ? "Strategy meets institutional deployment criteria. Validate with walk-forward before live trading."
                  : passed / total >= 0.5
                  ? "Strategy shows promise but needs improvement before institutional use."
                  : "Strategy requires significant refinement before deployment consideration."}
              </p>
            </div>
            <div
              className="text-2xl font-black tabular-nums"
              style={{
                color: passed / total >= 0.75 ? "#10b981" : passed / total >= 0.5 ? "#f59e0b" : "#f43f5e",
              }}
            >
              {Math.round((passed / total) * 100)}%
            </div>
          </div>
        </Section>

        {/* ── Step 8: Recommendations ── */}
        <Section
          step={qtableStates.length > 0 ? "8" : "7"}
          title="Prioritized Recommendations"
          subtitle="Action items ranked by impact on strategy performance and viability"
        >
          <div className="space-y-3">
            {recommendations.map((r, i) => (
              <div
                key={i}
                className="rounded-lg px-4 py-3 flex items-start gap-3"
                style={{
                  backgroundColor: "var(--c-bg)",
                  border: `1px solid ${r.color}25`,
                }}
              >
                <span
                  className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded mt-0.5"
                  style={{ color: r.color, backgroundColor: `${r.color}15` }}
                >
                  {r.priority}
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-200">{r.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

      </main>
    </div>
  );
}
