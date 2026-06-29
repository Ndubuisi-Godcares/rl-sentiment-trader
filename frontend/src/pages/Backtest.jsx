import { useEffect, useState, useCallback } from "react";
import { fetchBacktest, runBacktest, fetchLearning } from "../services/api";
import SymbolPicker from "../components/SymbolPicker";
import { useTheme } from "../context/ThemeContext";
import Topbar from "../components/Topbar";
import EquityChart from "../components/EquityChart";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function extractStatLocal(stats, fragments, column = 0) {
  if (!stats) return null;
  const cols = Object.keys(stats);
  const col  = cols[column] ?? cols[0];
  if (!col) return null;
  const rows = stats[col];
  const frags = Array.isArray(fragments) ? fragments : [fragments];
  for (const frag of frags) {
    const key = Object.keys(rows).find((k) => k.toLowerCase().includes(frag.toLowerCase()));
    if (key != null) return rows[key];
  }
  return null;
}

// ─── Engaging live progress view ─────────────────────────────────────────────

const TOTAL_MS = 10 * 60 * 1000; // ~10 min estimated

function makeStages(start, end) {
  return [
    { label: "Initializing SARSA strategy",                        from: 0,  to: 5  },
    { label: `Fetching Yahoo Finance data (${start} – ${end})`,    from: 5,  to: 50 },
    { label: "Running daily trading iterations",                   from: 50, to: 82 },
    { label: "Computing performance metrics",                      from: 82, to: 93 },
    { label: "Generating tearsheet report",                        from: 93, to: 100 },
  ];
}

function buildBaseline(stats) {
  if (!stats) return null;
  const cols = Object.keys(stats);
  const col = cols[0];
  if (!col) return null;
  const rows = stats[col];
  const pick = (fragment) => {
    const key = Object.keys(rows).find((k) => k.toLowerCase().includes(fragment));
    return key ? rows[key] : "--";
  };
  const cr = pick("total return") ?? pick("cum. return") ?? pick("cumulative");
  const dd = pick("drawdown");
  return [
    { label: "Total Return", value: cr ?? "--",      color: parseFloat(cr) >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "CAGR",         value: pick("cagr"),     color: "text-emerald-400" },
    { label: "Sharpe Ratio", value: pick("sharpe"),   color: "text-indigo-400"  },
    { label: "Max Drawdown", value: dd ?? "--",       color: "text-red-400"     },
  ];
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// ─── Learning visualization ───────────────────────────────────────────────────
const Q_ACTIONS = ["buy", "sell", "hold"];

const SENTIMENT_COLOR = { positive: "#10b981", neutral: "#94a3b8", negative: "#f43f5e" };
const TREND_COLOR  = { bull: "var(--c-positive)", bear: "var(--c-negative)", "n/a": "var(--c-text3)" };
const ACTION_COLOR = { buy: "var(--c-positive)", sell: "var(--c-negative)", hold: "var(--c-text3)" };

function stateColor(state) {
  if (state.startsWith("positive")) return SENTIMENT_COLOR.positive;
  if (state.startsWith("negative")) return SENTIMENT_COLOR.negative;
  return SENTIMENT_COLOR.neutral;
}

function QCell({ value }) {
  const v = value ?? 0;
  const norm = Math.max(-1, Math.min(1, v / 50));
  const green  = Math.round(Math.max(0, norm) * 100);
  const red    = Math.round(Math.max(0, -norm) * 100);
  const bg = norm >= 0
    ? `rgba(16,185,129,${0.08 + green / 250})`
    : `rgba(244,63,94,${0.08 + red / 250})`;
  const textColor = Math.abs(norm) < 0.05 ? "var(--c-text3)" : norm > 0 ? "var(--c-positive)" : "var(--c-negative)";
  return (
    <td
      className="text-center tabular-nums font-mono text-xs py-2 px-2"
      style={{ background: bg, color: textColor, borderRadius: 4 }}
    >
      {v === 0 ? "0.000" : v.toFixed(3)}
    </td>
  );
}

function Bar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px]">
        <span className="capitalize font-medium" style={{ color }}>{label}</span>
        <span className="text-slate-500 tabular-nums">{count ?? 0} ({pct}%)</span>
      </div>
      <div className="h-1.5 w-full bg-slate-700/50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function LearningPanel() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetchLearning();
        if (!cancelled && res.available) setData(res.state);
      } catch { /* ignore — backtest may not have written yet */ }
    };
    poll();
    const id = setInterval(poll, 4_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (!data) {
    return (
      <div
        className="rounded-xl px-5 py-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
        <span className="text-xs text-slate-500">Waiting for first 50 iterations before learning data appears…</span>
      </div>
    );
  }

  const qtable     = data.q_table ?? {};
  const actCounts  = data.action_counts ?? {};
  const sentCounts = data.sentiment_counts ?? {};
  const totalAct   = Object.values(actCounts).reduce((a, b) => a + b, 0);
  const totalSent  = Object.values(sentCounts).reduce((a, b) => a + b, 0);
  const recent     = data.recent_decisions ?? [];
  // Derive states dynamically from Q-table (handles composite states like "positive_bull")
  const qStates    = Object.keys(qtable).length > 0 ? Object.keys(qtable) : ["positive", "neutral", "negative"];
  const epsilonPct = data.epsilon != null ? Math.round(data.epsilon * 100) : null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: "var(--c-bg)", border: "1px solid rgba(99,102,241,0.2)" }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          <span className="text-xs font-semibold text-slate-300">Live Learning State</span>
          <span className="text-[10px] text-slate-600 tabular-nums">— iteration {data.iteration}</span>
          {epsilonPct != null && (
            <span className="text-[10px] text-slate-500 tabular-nums">
              · ε <span className="text-indigo-400">{epsilonPct}%</span>
            </span>
          )}
        </div>
        <svg
          viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 text-slate-600 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M1 4l5 5 5-5H1z" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-slate-700/30">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-4">
            {/* Q-Table */}
            <div className="lg:col-span-1 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Q-Table</p>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr>
                    <th className="text-left pr-2 text-slate-600 font-medium py-1 text-[10px]">State</th>
                    {Q_ACTIONS.map((a) => (
                      <th key={a} className="text-center text-slate-600 font-medium py-1 text-[10px] capitalize">{a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="space-y-1">
                  {qStates.map((s) => (
                    <tr key={s}>
                      <td className="pr-2 text-[10px] font-medium py-1 capitalize"
                          style={{ color: stateColor(s) }}>
                        {s.replace("_", " ")}
                      </td>
                      {Q_ACTIONS.map((a) => (
                        <QCell key={a} value={qtable[s]?.[a]} />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Distributions */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Actions Taken</p>
                {Q_ACTIONS.map((a) => (
                  <Bar key={a} label={a} count={actCounts[a] ?? 0} total={totalAct} color={ACTION_COLOR[a]} />
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Sentiment Seen</p>
                {Object.keys(sentCounts).map((s) => (
                  <Bar key={s} label={s} count={sentCounts[s] ?? 0} total={totalSent} color={SENTIMENT_COLOR[s] ?? "#94a3b8"} />
                ))}
              </div>
            </div>

            {/* Recent decisions feed */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recent Decisions</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {[...recent].reverse().map((d, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2 flex items-center gap-2"
                    style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border-s)" }}
                  >
                    <span className="text-[9px] font-mono text-slate-600 flex-shrink-0">{d.date}</span>
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
                      style={{ color: SENTIMENT_COLOR[d.sentiment] ?? "#94a3b8" }}
                    >{d.sentiment?.slice(0, 3)}</span>
                    {d.trend && d.trend !== "n/a" && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wide flex-shrink-0"
                        style={{ color: TREND_COLOR[d.trend] ?? "#64748b" }}
                      >{d.trend}</span>
                    )}
                    <span
                      className="text-xs font-bold uppercase tracking-wide flex-shrink-0"
                      style={{ color: ACTION_COLOR[d.action] }}
                    >{d.action}</span>
                    <span className="ml-auto text-[10px] tabular-nums text-slate-600">
                      {d.reward >= 0 ? "+" : ""}{d.reward?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Walk-forward results panel ───────────────────────────────────────────────

const WF_METRICS = [
  { label: "Total Return",  frags: ["total return", "cum. return", "cumulative return"] },
  { label: "CAGR",          frags: ["cagr"] },
  { label: "Sharpe",        frags: ["sharpe"] },
  { label: "Max Drawdown",  frags: ["max drawdown"] },
  { label: "Sortino",       frags: ["sortino"] },
];

function WalkForwardPanel({ wf }) {
  if (!wf?.train_stats && !wf?.test_stats) return null;
  const { train_period, test_period, train_stats, test_stats } = wf;

  return (
    <div
      className="rounded-xl p-6 space-y-5"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid rgba(99,102,241,0.25)" }}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-indigo-400 mb-0.5">
          Walk-Forward Validation
        </p>
        <p className="text-xs text-slate-500">
          Train: {train_period?.start} → {train_period?.end} &nbsp;·&nbsp;
          Test:  {test_period?.start}  → {test_period?.end}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 py-2 pr-4">
                Metric
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-500 py-2 pr-4">
                Train ({train_period?.start?.slice(0, 4)}–{train_period?.end?.slice(0, 4)})
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-400 py-2">
                Test ({test_period?.start?.slice(0, 4)}–{test_period?.end?.slice(0, 4)})
              </th>
            </tr>
          </thead>
          <tbody>
            {WF_METRICS.map(({ label, frags }) => {
              const tv = extractStatLocal(train_stats, frags);
              const xv = extractStatLocal(test_stats,  frags);
              return (
                <tr key={label}
                    className="border-t border-slate-700/30">
                  <td className="py-2 pr-4 text-slate-400 font-medium">{label}</td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums text-emerald-400">{tv ?? "--"}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-indigo-300">{xv ?? "--"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-600">
        Robust strategy: test metrics should be close to train metrics.
        Large drop = overfitting to training period.
      </p>
    </div>
  );
}

// ─── Multi-symbol results panel ───────────────────────────────────────────────

function MultiSymbolPanel({ results }) {
  if (!results?.length) return null;
  return (
    <div
      className="rounded-xl p-6 space-y-5"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Multi-Symbol Results
        </p>
        <h2 className="text-sm font-semibold text-slate-100">Portfolio Overview</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 py-2 pr-4">Symbol</th>
              {WF_METRICS.map(({ label }) => (
                <th key={label} className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 py-2 pr-3">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.symbol} className="border-t border-slate-700/30">
                <td className="py-2 pr-4 font-bold text-indigo-300">{r.symbol}</td>
                {WF_METRICS.map(({ label, frags }) => {
                  const v = extractStatLocal(r.stats ?? r.test_stats, frags);
                  return (
                    <td key={label} className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">{v ?? "--"}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Running view ─────────────────────────────────────────────────────────────

function RunningView({ startedAt, startDate, endDate, symbol = "SPY", lastStats = null, phase = null }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const pct = Math.min((elapsed / TOTAL_MS) * 100, 99);
  const STAGES = makeStages(startDate, endDate);
  const currentStage = STAGES.findLastIndex((s) => pct >= s.from);

  return (
    <div
      className="rounded-xl p-6 space-y-6"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 flex-shrink-0">
            <svg className="w-9 h-9 text-indigo-500 animate-spin" style={{ animationDuration: "2s" }} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Backtest Running
              {phase && (
                <span
                  className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: phase === "training" ? "rgba(16,185,129,0.12)" : phase === "testing" ? "rgba(99,102,241,0.12)" : "rgba(51,65,85,0.4)",
                    color: phase === "training" ? "var(--c-positive)" : phase === "testing" ? "var(--c-accent)" : "var(--c-text3)",
                  }}
                >
                  {phase}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{symbol} · {startDate} → {endDate} · SARSA ε-greedy</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-0.5">Elapsed</p>
          <p className="text-2xl font-bold tabular-nums text-slate-200 tracking-tight">
            {fmtElapsed(elapsed)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500 font-medium">Estimated progress</span>
          <span className="text-xs font-bold tabular-nums text-slate-300">{Math.round(pct)}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-[1200ms] ease-out"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #4f46e5, #818cf8, #6ee7b7)",
              boxShadow: "0 0 14px rgba(99,102,241,0.6)",
            }}
          />
        </div>
        <p className="text-[10px] text-slate-600">Estimated total: ~10 min · Results load automatically when done</p>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {STAGES.map((stage, i) => {
          const done   = pct >= stage.to;
          const active = i === currentStage && !done;
          return (
            <div key={i} className="flex items-center gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {done ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-400">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                ) : active ? (
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500" />
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-700" />
                )}
              </div>
              <span
                className={`text-sm transition-colors duration-300 ${
                  done   ? "text-slate-600 line-through decoration-slate-700"
                  : active ? "text-slate-100 font-semibold"
                  : "text-slate-600"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Baseline reference — from last completed backtest */}
      {(() => {
        const baseline = buildBaseline(lastStats);
        if (!baseline) return null;
        return (
          <div className="border-t border-slate-700/50 pt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 mb-3">
              Previous Run Results
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {baseline.map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-lg px-3 py-3"
                  style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
                >
                  <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-1.5">{label}</p>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value ?? "--"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Live learning visualization */}
      <LearningPanel />
    </div>
  );
}

// Metrics to pin at the top of the stats table
const PRIORITY_METRICS = ["cumulative", "cagr", "sharpe", "drawdown", "volatility", "sortino", "calmar", "win"];

function fmt(v) {
  if (v == null) return "--";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "--";
    return Math.abs(v) >= 100
      ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : v.toFixed(4);
  }
  return String(v);
}

function StatsTable({ stats }) {
  const columns = Object.keys(stats);
  if (!columns.length) return null;

  const allMetrics = Object.keys(stats[columns[0]] ?? {});
  const sorted = [
    ...allMetrics.filter((m) => PRIORITY_METRICS.some((p) => m.toLowerCase().includes(p))),
    ...allMetrics.filter((m) => !PRIORITY_METRICS.some((p) => m.toLowerCase().includes(p))),
  ];

  const TH = "py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50";

  return (
    <div
      className="rounded-xl p-6 overflow-x-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Statistics
        </p>
        <h2 className="text-sm font-semibold text-slate-100">Performance Metrics</h2>
        <p className="text-xs text-slate-600 mt-0.5">SPY Backtest</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={`${TH} text-left pl-1 pr-4`}>Metric</th>
            {columns.map((col) => (
              <th key={col} className={`${TH} text-right`}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((metric, idx) => (
            <tr
              key={metric}
              className="hover:bg-indigo-500/5 transition-colors"
              style={{ backgroundColor: idx % 2 === 0 ? "var(--c-bg)" : "transparent" }}
            >
              <td className="py-2 pl-1 pr-4 text-slate-400 font-medium whitespace-nowrap">{metric}</td>
              {columns.map((col) => (
                <td key={col} className="py-2 text-right text-slate-200 tabular-nums font-mono text-xs">
                  {fmt(stats[col]?.[metric])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TradesTable({ trades }) {
  if (!trades?.length) return null;
  const columns = Object.keys(trades[0]).filter(
    (k) => !["id", "uuid"].includes(k.toLowerCase())
  );
  const TH = "py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50 text-right first:text-left";

  return (
    <div
      className="rounded-xl p-6 overflow-x-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">Log</p>
          <h2 className="text-sm font-semibold text-slate-100">Backtest Trades</h2>
        </div>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border"
          style={{ color: "var(--c-accent)", backgroundColor: "var(--c-chip-bg)", borderColor: "var(--c-border)" }}
        >
          {trades.length} trades
        </span>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className={TH}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((row, idx) => (
            <tr
              key={idx}
              className="hover:bg-indigo-500/5 transition-colors"
              style={{ backgroundColor: idx % 2 === 0 ? "var(--c-bg)" : "transparent" }}
            >
              {columns.map((col) => (
                <td
                  key={col}
                  className="py-2 pr-4 first:pl-1 last:pr-1 text-right first:text-left text-slate-300 tabular-nums whitespace-nowrap"
                >
                  {row[col] ?? "--"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl p-12 flex flex-col items-center gap-3 text-slate-600"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-slate-700">
        <rect x="4" y="4" width="32" height="32" rx="4" />
        <path d="M12 28l6-8 5 6 4-5 5 7" />
      </svg>
      <p className="text-sm font-medium text-slate-500">No backtest results yet</p>
      <p className="text-xs text-slate-600 text-center max-w-xs">
        Click <strong className="text-slate-400">Run Backtest</strong> above to start a new run,
        or run <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">python trading_engine/sarsa-v1.py</code> directly.
      </p>
    </div>
  );
}

const TODAY = new Date().toISOString().split("T")[0];

function _loadCachedBacktest() {
  try {
    const s = localStorage.getItem("sarsa_backtest_cache");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function Backtest() {
  const cachedData = useState(() => _loadCachedBacktest())[0];
  const [data, setData] = useState(cachedData);
  // Skip the skeleton when we already have cached data to show
  const [loading, setLoading] = useState(!cachedData);
  const [triggering, setTriggering] = useState(false);
  const [started, setStarted] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [startDate, setStartDate]     = useState("2020-01-01");
  const [endDate, setEndDate]         = useState(TODAY);
  const [walkForward, setWalkForward] = useState(false);
  const [extraSymbols, setExtraSymbols] = useState([]); // up to 4 additional
  const { symbol, setSymbol, isLight } = useTheme();

  const load = useCallback(async () => {
    try {
      const d = await fetchBacktest();
      setData(d);
      setLastUpdated(new Date());
      setError(null);
      // Persist last-good data so navigate-back shows it instantly
      if (d.available) {
        try { localStorage.setItem("sarsa_backtest_cache", JSON.stringify(d)); } catch {}
      }
      if (!d.running) {
        setStarted(false);
        localStorage.removeItem("sarsa_backtest_run");
      } else {
        // Restore running-state in the same render batch to avoid blank flash
        const saved = localStorage.getItem("sarsa_backtest_run");
        if (saved) {
          try {
            const { startedAt: savedAt, startDate: sd, endDate: ed, symbol: sym } = JSON.parse(saved);
            setStarted(true);
            setStartedAt(savedAt);
            if (sd) setStartDate(sd);
            if (ed) setEndDate(ed);
            if (sym) setSymbol(sym);
          } catch {}
        } else {
          setStarted(true);
          setStartedAt(Date.now());
        }
      }
      return d;
    } catch {
      setError("Could not reach the backend. Is it running?");
      setStarted(false);
    } finally {
      setLoading(false);
    }
  }, [setSymbol]);

  // On mount: fetch fresh data (cached data shows immediately while this runs)
  useEffect(() => {
    load();
  }, [load]);

  // Poll every 5 s while running (either confirmed by server or optimistically started)
  const isRunning = data?.running || started;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, [isRunning, load]);

  const allSymbols = [symbol, ...extraSymbols].filter(Boolean);

  const handleRun = async () => {
    setError(null);
    setTriggering(true);
    try {
      await runBacktest(startDate, endDate, symbol, {
        walkForward,
        symbols: allSymbols.length > 1 ? allSymbols : null,
      });
      const now = Date.now();
      setStarted(true);
      setStartedAt(now);
      localStorage.setItem("sarsa_backtest_run", JSON.stringify({
        startedAt: now, startDate, endDate, symbol, walkForward,
        symbols: allSymbols,
      }));
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Failed to start backtest.");
    } finally {
      setTriggering(false);
    }
  };

  const busy = triggering || isRunning;

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title="Backtest" lastUpdated={lastUpdated} onRefresh={load} />

      <main className="pt-14 px-6 py-6 space-y-6 max-w-screen-xl">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
              SARSA Strategy
            </p>
            <h2 className="text-lg font-bold text-slate-100">Backtest Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">{symbol} · Yahoo Finance data · FinBERT + SARSA</p>
            {data?.last_run && !isRunning && (
              <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5">
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest"
                  style={{ backgroundColor: "var(--c-bg2)", color: "var(--c-text3)" }}
                >
                  Previous run
                </span>
                {new Date(data.last_run).toLocaleString()}
                {data?.config && (
                  <span className="text-slate-700">
                    · {data.config.symbol ?? "SPY"} · {data.config.start_date} → {data.config.end_date}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Primary symbol */}
            <SymbolPicker value={symbol} onChange={setSymbol} disabled={busy} />

            {/* Extra symbols for multi-symbol portfolio */}
            {extraSymbols.map((sym, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <SymbolPicker
                  value={sym}
                  onChange={(s) => setExtraSymbols((prev) => { const n = [...prev]; n[idx] = s; return n; })}
                  disabled={busy}
                />
                <button
                  onClick={() => setExtraSymbols((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={busy}
                  className="text-slate-600 hover:text-red-400 transition-colors text-xs px-1"
                  title="Remove symbol"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Add symbol button (max 5 total) */}
            {allSymbols.length < 5 && (
              <button
                onClick={() => setExtraSymbols((prev) => [...prev, "QQQ"])}
                disabled={busy}
                className="text-[10px] font-semibold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-40"
              >
                + Add Symbol
              </button>
            )}

            {/* Date range picker */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: "var(--c-bg3)", border: "1px solid var(--c-border)" }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">From</span>
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={busy}
                className="bg-transparent text-slate-200 text-xs font-mono border-0 outline-none disabled:opacity-40"
                style={{ colorScheme: isLight ? "light" : "dark" }}
              />
              <span className="text-slate-600 text-xs">→</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">To</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={TODAY}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={busy}
                className="bg-transparent text-slate-200 text-xs font-mono border-0 outline-none disabled:opacity-40"
                style={{ colorScheme: isLight ? "light" : "dark" }}
              />
            </div>

            {/* Walk-forward toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => !busy && setWalkForward((v) => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${walkForward ? "bg-indigo-500" : "bg-slate-700"} ${busy ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${walkForward ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Walk-Forward
              </span>
            </label>

            <button
              onClick={handleRun}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
              style={{ backgroundColor: "#6366f1" }}
            >
              {triggering ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Starting…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z" />
                  </svg>
                  {isRunning ? "Running…" : "Run Backtest"}
                </>
              )}
            </button>
            {isRunning && (
              <span className="text-[10px] text-slate-600 tabular-nums">
                Auto-refreshing every 5s
              </span>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="rounded-xl px-5 py-3 text-sm text-red-300 flex items-start gap-3"
            style={{ backgroundColor: "rgba(127,29,29,0.2)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Live progress view — replaces old results while running */}
        {isRunning && startedAt && (
          <RunningView
            startedAt={startedAt}
            startDate={startDate}
            endDate={endDate}
            symbol={allSymbols.join(", ")}
            lastStats={data?.stats ?? null}
            phase={data?.phase ?? null}
          />
        )}

        {/* Skeleton on initial load */}
        {loading && !isRunning && (
          <div className="space-y-4">
            <div className="h-64 rounded-xl bg-slate-800/40 animate-pulse" />
            <div className="h-48 rounded-xl bg-slate-800/40 animate-pulse" />
          </div>
        )}

        {/* Results — only shown when NOT running */}
        {!loading && !isRunning && data?.available && (
          <>
            {/* Walk-forward comparison (if available) */}
            {data.walk_forward && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
                  Walk-Forward Validation
                </p>
                <WalkForwardPanel wf={data.walk_forward} />
              </section>
            )}

            {/* Multi-symbol portfolio overview (if available) */}
            {data.multi_results?.length > 1 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
                  Portfolio Overview
                </p>
                <MultiSymbolPanel results={data.multi_results} />
              </section>
            )}

            {/* Equity curve from portfolio time-series */}
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
                Equity Curve
              </p>
              <EquityChart data={data.portfolio_series ?? []} />
            </section>

            {/* Summary stats table — only if lumibot wrote a metrics CSV */}
            {data.stats && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
                  Statistics
                </p>
                <StatsTable stats={data.stats} />
              </section>
            )}

            {/* Trade log */}
            {data.trades?.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
                  Trade Log
                </p>
                <TradesTable trades={data.trades} />
              </section>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !isRunning && !data?.available && <EmptyState />}
      </main>
    </div>
  );
}
