/**
 * A single KPI tile used across the dashboard header row.
 *
 * Props:
 *   label   string  — display label
 *   value   string  — formatted value or "--" when unavailable
 *   sub     string? — optional secondary line (e.g. "vs SPY 79.08%")
 *   color   string? — Tailwind text colour class for the value (default white)
 *   loading bool?   — shows a skeleton pulse when true
 *
 * Visual: glassmorphism card with a 3px left accent border derived from color prop.
 */

function accentColor(colorClass) {
  if (colorClass?.includes("emerald")) return "#34d399";
  if (colorClass?.includes("red"))     return "#f87171";
  return "#6366f1"; // default indigo
}

function TrendArrow({ colorClass }) {
  if (colorClass?.includes("emerald")) {
    return (
      <svg viewBox="0 0 10 10" fill="currentColor" className="w-3 h-3 text-emerald-400 flex-shrink-0">
        <path d="M5 1l4 7H1l4-7z" />
      </svg>
    );
  }
  if (colorClass?.includes("red")) {
    return (
      <svg viewBox="0 0 10 10" fill="currentColor" className="w-3 h-3 text-red-400 flex-shrink-0">
        <path d="M5 9L1 2h8L5 9z" />
      </svg>
    );
  }
  return null;
}

export default function MetricCard({ label, value, sub, color = "text-white", loading = false }) {
  const accent = accentColor(color);

  return (
    <div
      className="relative rounded-xl px-4 py-3.5 flex flex-col gap-1 min-w-0 overflow-hidden"
      style={{
        backgroundColor: "rgba(30,41,59,0.4)",
        border: "1px solid rgba(51,65,85,0.5)",
        borderLeft: `3px solid ${accent}`,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Label */}
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500 truncate">
        {label}
      </span>

      {/* Value */}
      {loading ? (
        <div className="h-6 w-20 bg-slate-700/60 rounded animate-pulse mt-1" />
      ) : (
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          <TrendArrow colorClass={color} />
          <span
            className={`text-base font-bold tabular-nums tracking-tight truncate ${color}`}
            title={value}
          >
            {value}
          </span>
        </div>
      )}

      {/* Sub */}
      {sub && !loading && (
        <span className="text-[10px] text-slate-600 mt-0.5 leading-tight truncate">{sub}</span>
      )}

      {/* Subtle corner glow */}
      <span
        className="pointer-events-none absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-10"
        style={{ backgroundColor: accent, filter: "blur(16px)" }}
      />
    </div>
  );
}
