import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

/**
 * Portfolio equity curve from backtest_series.
 *
 * Props:
 *   data  array  — rows from GET /portfolio backtest_series
 *                  Each row has a date-ish key and one or more value keys.
 */

const STARTING_BUDGET = 100_000;

// Colour palette: strategy = indigo, others cycle through teal / violet
const SERIES_COLORS = ["#6366f1", "#2dd4bf", "#a78bfa"];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "#0f172a",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 8,
        padding: "10px 14px",
        minWidth: 180,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ color: "#64748b", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {label}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 2 }}>
          <span style={{ color: entry.color, fontSize: 12 }}>{entry.name}</span>
          <span style={{ color: "#f1f5f9", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
            ${Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EquityChart({ data = [], dateRange = null }) {
  if (!data.length) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center text-slate-500 text-sm h-64 gap-2"
        style={{
          backgroundColor: "rgba(30,41,59,0.4)",
          border: "1px solid rgba(51,65,85,0.5)",
        }}
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8 text-slate-700" stroke="currentColor" strokeWidth="1.5">
          <polyline points="4,32 14,20 22,26 36,8" />
        </svg>
        <span>No backtest data yet — run</span>
        <code className="text-slate-400 text-xs bg-slate-800 px-2 py-0.5 rounded">
          python trading_engine/sarsa-v1.py
        </code>
      </div>
    );
  }

  const firstRow = data[0];
  const dateKey = Object.keys(firstRow).find((k) => /date|time|index/i.test(k)) ?? Object.keys(firstRow)[0];
  // Show only portfolio_value on the equity curve — cash spikes are misleading
  const allNumericKeys = Object.keys(firstRow).filter(
    (k) => k !== dateKey && typeof firstRow[k] === "number"
  );
  const valueKeys = allNumericKeys.includes("portfolio_value")
    ? ["portfolio_value"]
    : allNumericKeys.slice(0, 1);

  const derivedRange = dateRange ?? (data.length
    ? `${data[0][dateKey]?.slice(0, 7)} – ${data[data.length - 1][dateKey]?.slice(0, 7)}`
    : null);

  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: "rgba(30,41,59,0.4)",
        border: "1px solid rgba(51,65,85,0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
            Equity Curve
          </p>
          <h2 className="text-sm font-semibold text-slate-100">Portfolio Equity Curve</h2>
          {derivedRange && <p className="text-xs text-slate-600 mt-0.5">Backtest {derivedRange}</p>}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] text-slate-400 font-medium">SARSA Strategy</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          {/* Gradient definitions */}
          <defs>
            {valueKeys.map((key, i) => (
              <linearGradient key={key} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={SERIES_COLORS[i % SERIES_COLORS.length]} stopOpacity={0.01} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid strokeDasharray="2 4" stroke="rgba(51,65,85,0.4)" vertical={false} />

          <XAxis
            dataKey={dateKey}
            tick={{ fill: "#475569", fontSize: 10, fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#475569", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            width={44}
          />

          {/* Reference line at starting budget */}
          <ReferenceLine
            y={STARTING_BUDGET}
            stroke="rgba(100,116,139,0.4)"
            strokeDasharray="4 4"
            label={{
              value: "$100k",
              position: "insideTopRight",
              fill: "#475569",
              fontSize: 9,
              fontWeight: 600,
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ color: "#64748b", fontSize: 11, paddingTop: 12 }}
            iconType="circle"
            iconSize={6}
          />

          {valueKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={1.5}
              fill={`url(#grad-${i})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
