import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchComparison } from "../services/api";
import Topbar from "../components/Topbar";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt$ = (n) =>
  n == null
    ? "--"
    : "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (n) =>
  n == null ? "--" : (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";

function extractStat(stats, fragmentOrFragments, column = 0) {
  if (!stats) return null;
  const cols = Object.keys(stats);
  const col = cols[column] ?? cols[0];
  if (!col) return null;
  const rows = stats[col];
  const fragments = Array.isArray(fragmentOrFragments)
    ? fragmentOrFragments
    : [fragmentOrFragments];
  for (const frag of fragments) {
    const key = Object.keys(rows).find((k) =>
      k.toLowerCase().includes(frag.toLowerCase())
    );
    if (key != null) return rows[key];
  }
  return null;
}

// ─── Comparison chart ────────────────────────────────────────────────────────

function alignSeries(sarsaSeries, benchmarkSeries) {
  const sarsaMap = {};
  for (const r of sarsaSeries) sarsaMap[r.date] = r.portfolio_value;
  const bmMap = {};
  for (const r of benchmarkSeries) bmMap[r.date] = r.portfolio_value;

  const allDates = [
    ...new Set([...Object.keys(sarsaMap), ...Object.keys(bmMap)]),
  ].sort();

  return allDates
    .map((date) => ({
      date,
      sarsa:     sarsaMap[date] ?? null,
      benchmark: bmMap[date]    ?? null,
    }))
    .filter((r) => r.sarsa != null || r.benchmark != null);
}

function ComparisonChart({ sarsa, benchmark, symbol = "Strategy" }) {
  const combined = alignSeries(sarsa, benchmark);
  if (!combined.length) return null;

  const ticks = combined
    .filter((_, i) => i % Math.max(1, Math.floor(combined.length / 6)) === 0)
    .map((r) => r.date);

  // Defined inside the component so it closes over `symbol`
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ backgroundColor: "var(--c-bg-deep)", border: "1px solid var(--c-border)", boxShadow: "0 8px 32px var(--c-shadow, rgba(0,0,0,0.4))" }}
      >
        <p className="text-slate-500 mb-2">{label}</p>
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-3 justify-between">
            <span className="flex items-center gap-1.5" style={{ color: p.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.dataKey === "sarsa" ? `${symbol} SARSA` : `${symbol} Buy & Hold`}
            </span>
            <span className="font-bold tabular-nums text-slate-200">
              {p.value != null ? fmt$(p.value) : "--"}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Portfolio Growth
        </p>
        <h2 className="text-sm font-semibold text-slate-100">
          {symbol} SARSA vs {symbol} Buy &amp; Hold
        </h2>
        <p className="text-xs text-slate-600 mt-0.5">Both starting from $100,000 initial capital</p>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={combined} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(51,65,85,0.3)" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(val) => val === "sarsa" ? `${symbol} SARSA` : `${symbol} Buy & Hold`}
          />
          <Line
            type="monotone"
            dataKey="sarsa"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="benchmark"
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Head-to-head metrics ─────────────────────────────────────────────────────

const COMPARE_ROWS = [
  { label: "Total Return",  fragment: ["total return", "cum. return", "cumulative return"], format: "pct", drawdownMode: false, lowerVolMode: false },
  { label: "CAGR",          fragment: ["cagr"],                                             format: "pct", drawdownMode: false, lowerVolMode: false },
  { label: "Sharpe Ratio",  fragment: ["sharpe"],                                           format: "num", drawdownMode: false, lowerVolMode: false },
  { label: "Max Drawdown",  fragment: ["max drawdown"],                                     format: "pct", drawdownMode: true,  lowerVolMode: false },
  { label: "Volatility",    fragment: ["volatil"],                                          format: "pct", drawdownMode: false, lowerVolMode: true  },
  { label: "Sortino Ratio", fragment: ["sortino"],                                          format: "num", drawdownMode: false, lowerVolMode: false },
  { label: "Calmar Ratio",  fragment: ["calmar"],                                           format: "num", drawdownMode: false, lowerVolMode: false },
  { label: "Win Rate",      fragment: ["win days%", "win rate", "win%"],                    format: "pct", drawdownMode: false, lowerVolMode: false },
];

function winner(a, b, drawdownMode = false, lowerVolMode = false) {
  const n = (v) => { if (v == null) return null; const f = parseFloat(v); return isNaN(f) ? null : f; };
  const av = n(a), bv = n(b);
  if (av == null || bv == null) return null;
  if (drawdownMode)  return av > bv  ? "sarsa" : "spy"; // less negative = better
  if (lowerVolMode)  return av < bv  ? "sarsa" : "spy"; // lower volatility = better
  return av >= bv ? "sarsa" : "spy";
}

function MetricsTable({ stats, symbol = "SARSA" }) {
  if (!stats) return null;
  const cols = Object.keys(stats);
  // cols[0] = "Strategy", cols[1] = benchmark column (QQQ, SPY, Benchmark, etc.)
  const spyCol = cols[1];

  return (
    <div
      className="rounded-xl p-6 overflow-x-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Head-to-Head
        </p>
        <h2 className="text-sm font-semibold text-slate-100">Key Metrics Comparison</h2>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-3 pr-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50">
              Metric
            </th>
            <th className="py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-400 border-b border-slate-700/50">
              {symbol} SARSA
            </th>
            <th className="py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400 border-b border-slate-700/50 pl-4">
              {symbol} B&amp;H
            </th>
            <th className="py-3 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50 pl-4">
              Edge
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_ROWS.map(({ label, fragment, drawdownMode, lowerVolMode }, idx) => {
            const sv  = extractStat(stats, fragment, 0);
            const bv  = extractStat(stats, fragment, 1);
            const win = winner(sv, bv, drawdownMode, lowerVolMode);
            return (
              <tr
                key={label}
                className="hover:bg-indigo-500/5 transition-colors"
                style={{ backgroundColor: idx % 2 === 0 ? "rgba(30,41,59,0.2)" : "transparent" }}
              >
                <td className="py-2.5 pr-4 text-slate-400 font-medium">{label}</td>
                <td
                  className={`py-2.5 text-right tabular-nums font-mono text-xs ${
                    win === "sarsa" ? "text-emerald-400 font-semibold" : "text-slate-300"
                  }`}
                >
                  {sv ?? "--"}
                </td>
                <td
                  className={`py-2.5 text-right tabular-nums font-mono text-xs pl-4 ${
                    win === "spy" ? "text-amber-300 font-semibold" : "text-slate-400"
                  }`}
                >
                  {bv ?? "--"}
                </td>
                <td className="py-2.5 text-center pl-4">
                  {win === "sarsa" ? (
                    <span className="text-[10px] font-bold text-emerald-400">{symbol} ✓</span>
                  ) : win === "spy" ? (
                    <span className="text-[10px] font-bold text-amber-400">B&amp;H ✓</span>
                  ) : (
                    <span className="text-[10px] text-slate-700">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Attribution cards ────────────────────────────────────────────────────────

function AttributionSection({ attribution, stats, symbol = "Strategy" }) {
  const totalReturn  = extractStat(stats, ["cum. return", "cumulative return", "total return"], 0);
  const spyReturn    = extractStat(stats, ["cum. return", "cumulative return", "total return"], 1);
  const sharpe       = extractStat(stats, "sharpe", 0);
  const drawdown     = extractStat(stats, "drawdown", 0);

  const totalTrades  = attribution?.total_trades ?? 0;
  const winRate      = attribution?.win_rate;
  const buyCount     = attribution?.buy_count ?? 0;
  const sellCount    = attribution?.sell_count ?? 0;

  const cards = [
    {
      title: "Active Trading",
      value: `${totalTrades} trades`,
      desc: `${buyCount} buys · ${sellCount} sells — SARSA learned when to act vs hold.`,
      color: "var(--c-accent)",
    },
    {
      title: "Win Rate",
      value: winRate != null ? `${winRate}%` : "--",
      desc: `${attribution?.winning_trades ?? 0} profitable exits out of ${attribution?.buy_count ?? 0} trades matched.`,
      color: "var(--c-positive)",
    },
    {
      title: "Return vs Benchmark",
      value: totalReturn != null && spyReturn != null ? fmtPct(parseFloat(totalReturn) - parseFloat(spyReturn)) : "--",
      desc: `Cumulative alpha generated vs ${symbol} buy-and-hold over the same period.`,
      color: "var(--c-warn)",
    },
    {
      title: "Risk-Adjusted Edge",
      value: sharpe ?? "--",
      desc: `Sharpe Ratio. Max drawdown ${drawdown ?? "--"} — compared to ${symbol} buy-and-hold drawdowns.`,
      color: "var(--c-accent)",
    },
  ];

  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Attribution
        </p>
        <h2 className="text-sm font-semibold text-slate-100">What Drove the {symbol} Strategy</h2>
        <p className="text-xs text-slate-600 mt-0.5">
          FinBERT classified {symbol} news headlines → SARSA chose actions based on learned Q-values
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map(({ title, value, desc, color }) => (
          <div
            key={title}
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</p>
            <p className="text-xl font-bold tabular-nums" style={{ color }}>{value}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* How it works note */}
      <div
        className="mt-5 rounded-lg p-4"
        style={{ backgroundColor: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
      >
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-indigo-400">How the edge is created:</span>{" "}
          FinBERT reads recent news and classifies market sentiment. SARSA updates its Q-table
          based on price movements after each action, gradually learning which sentiment states
          favour buying vs selling. Over time it reduces maximum drawdown by acting on negative
          sentiment signals rather than passively holding {symbol} through downturns.
        </p>
      </div>
    </div>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────

function Empty() {
  return (
    <div
      className="rounded-xl p-12 flex flex-col items-center gap-3 text-slate-600"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-slate-700">
        <path d="M4 34 L14 20 L22 28 L30 14 L36 20" />
        <path d="M4 34 L14 20 L22 28 L30 14 L36 20" strokeDasharray="3 2" opacity="0.4" />
      </svg>
      <p className="text-sm font-medium text-slate-500">No backtest data available</p>
      <p className="text-xs text-slate-600 text-center max-w-xs">
        Run a backtest first from the <strong className="text-slate-400">Backtest</strong> page,
        then return here to see the comparison.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Comparison() {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchComparison();
      setData(d);
      setLastUpdated(new Date());
    } catch {
      setError("Could not load comparison data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const available = data?.available;
  const symbol = available ? (data?.symbol ?? "?") : "?";

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title={available && symbol !== "?" ? `${symbol} vs Buy & Hold` : "vs Buy & Hold"} lastUpdated={lastUpdated} onRefresh={load} />

      <main className="pt-14 px-6 py-6 space-y-6 max-w-screen-xl">
        {/* Page header */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
            Performance Analysis
          </p>
          <h2 className="text-lg font-bold text-slate-100">{symbol} SARSA vs {symbol} Buy &amp; Hold</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            How the FinBERT + SARSA strategy compares to passively holding {symbol}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-xl px-5 py-3 text-sm text-red-300"
            style={{ backgroundColor: "rgba(127,29,29,0.2)", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-72 rounded-xl bg-slate-800/40 animate-pulse" />
            <div className="h-80 rounded-xl bg-slate-800/40 animate-pulse" />
          </div>
        )}

        {!loading && !available && <Empty />}

        {!loading && available && (
          <>
            {/* Combined chart */}
            <section>
              <ComparisonChart
                sarsa={data.sarsa_series ?? []}
                benchmark={data.benchmark_series ?? data.spy_series ?? []}
                symbol={symbol}
              />
            </section>

            {/* Metrics table */}
            {data.stats && (
              <section>
                <MetricsTable stats={data.stats} symbol={symbol} />
              </section>
            )}

            {/* Attribution */}
            <section>
              <AttributionSection attribution={data.attribution ?? {}} stats={data.stats} symbol={symbol} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
