/**
 * Renders the list of currently open Alpaca paper-trading positions.
 *
 * Props:
 *   positions  array   — rows from GET /positions
 *   loading    bool
 */

const fmt = (n, decimals = 2) =>
  n == null
    ? "--"
    : Number(n).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function PnlBadge({ value, pct }) {
  const positive = value > 0;
  const negative = value < 0;

  const colorClass = positive
    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : negative
    ? "text-red-400 bg-red-400/10 border-red-400/20"
    : "text-slate-400 bg-slate-700/30 border-slate-600/30";

  const prefix = value >= 0 ? "+" : "";

  return (
    <span
      className={`inline-flex flex-col items-end gap-0 px-2 py-0.5 rounded-md border text-xs font-semibold tabular-nums ${colorClass}`}
    >
      <span>
        {prefix}${fmt(value)}
      </span>
      <span className="text-[10px] opacity-70">
        {prefix}{fmt(pct * 100)}%
      </span>
    </span>
  );
}

const COL_HEADER = "pb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 select-none";

export default function PositionsTable({ positions = [], loading = false }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: "rgba(30,41,59,0.4)",
        border: "1px solid rgba(51,65,85,0.5)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
            Positions
          </p>
          <h2 className="text-sm font-semibold text-slate-100">Open Position</h2>
        </div>
        {!loading && (
          <span
            className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{
              color: positions.length ? "#818cf8" : "#475569",
              backgroundColor: positions.length ? "rgba(99,102,241,0.1)" : "transparent",
              borderColor: positions.length ? "rgba(99,102,241,0.25)" : "rgba(71,85,105,0.3)",
            }}
          >
            {positions.length} open
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-700/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-40">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span className="text-sm">No open positions</span>
          <span className="text-xs text-slate-700 text-center max-w-xs">
            Positions appear here when the strategy holds shares at the end of a backtest, or when running live on Alpaca paper trading.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className={`${COL_HEADER} text-left pl-1`}>Symbol</th>
                <th className={`${COL_HEADER} text-right`}>Qty</th>
                <th className={`${COL_HEADER} text-right`}>Avg Entry</th>
                <th className={`${COL_HEADER} text-right`}>Current</th>
                <th className={`${COL_HEADER} text-right`}>Mkt Value</th>
                <th className={`${COL_HEADER} text-right pr-1`}>P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={p.symbol}
                    className="group transition-colors duration-100 hover:bg-indigo-500/5"
                    style={{
                      backgroundColor: isEven ? "rgba(30,41,59,0.2)" : "transparent",
                    }}
                  >
                    {/* Symbol + source badge */}
                    <td className="py-2.5 pl-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-100 tracking-wide">{p.symbol}</span>
                        {p.source === "backtest" && (
                          <span
                            className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
                          >
                            backtest
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="py-2.5 text-right text-slate-400 tabular-nums">{fmt(p.qty, 0)}</td>

                    {/* Avg entry */}
                    <td className="py-2.5 text-right text-slate-400 tabular-nums">
                      ${fmt(p.avg_entry_price)}
                    </td>

                    {/* Current price */}
                    <td className="py-2.5 text-right text-slate-300 tabular-nums font-medium">
                      ${fmt(p.current_price)}
                    </td>

                    {/* Market value */}
                    <td className="py-2.5 text-right text-slate-400 tabular-nums">
                      ${fmt(p.market_value)}
                    </td>

                    {/* P&L pill */}
                    <td className="py-2.5 pr-1 text-right">
                      <PnlBadge value={p.unrealized_pl} pct={p.unrealized_plpc} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
