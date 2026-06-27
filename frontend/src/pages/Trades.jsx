import { useEffect, useState, useCallback } from "react";
import { fetchTrades } from "../services/api";
import Topbar from "../components/Topbar";

const fmt = (v, decimals = 2) =>
  v == null ? "--" : Number(v).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function SideBadge({ side }) {
  const isBuy = side?.toLowerCase() === "buy";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${
        isBuy
          ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"
          : "text-red-400 bg-red-400/10 border border-red-400/20"
      }`}
    >
      {side ?? "--"}
    </span>
  );
}

function StatusBadge({ status }) {
  const filled = status === "filled";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest ${
        filled
          ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20"
          : "text-slate-400 bg-slate-700/30 border border-slate-600/30"
      }`}
    >
      {status ?? "--"}
    </span>
  );
}

function LiveTradesTable({ trades }) {
  const TH = "py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50 text-right first:text-left";

  return (
    <div
      className="rounded-xl p-6 overflow-x-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">Alpaca</p>
          <h2 className="text-sm font-semibold text-slate-100">Live Order History</h2>
          <p className="text-xs text-slate-600 mt-0.5">Last 50 closed orders from paper account</p>
        </div>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ color: "var(--c-accent)", backgroundColor: "var(--c-chip-bg)", borderColor: "var(--c-border)" }}
        >
          {trades.length} orders
        </span>
      </div>

      {trades.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2 text-slate-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 opacity-40">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span className="text-sm">No closed orders found</span>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className={`${TH} text-left`}>Symbol</th>
              <th className={`${TH} text-left`}>Side</th>
              <th className={TH}>Qty</th>
              <th className={TH}>Fill Price</th>
              <th className={`${TH} text-left`}>Status</th>
              <th className={TH}>Submitted</th>
              <th className={TH}>Filled</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, idx) => (
              <tr
                key={t.id ?? idx}
                className="hover:bg-indigo-500/5 transition-colors"
                style={{ backgroundColor: idx % 2 === 0 ? "rgba(30,41,59,0.2)" : "transparent" }}
              >
                <td className="py-2.5 pl-0 font-semibold text-slate-100 tracking-wide">{t.symbol}</td>
                <td className="py-2.5"><SideBadge side={t.side} /></td>
                <td className="py-2.5 text-right text-slate-400 tabular-nums">{fmt(t.qty, 0)}</td>
                <td className="py-2.5 text-right text-slate-300 tabular-nums font-medium">
                  {t.filled_avg_price != null ? `$${fmt(t.filled_avg_price)}` : "--"}
                </td>
                <td className="py-2.5"><StatusBadge status={t.status} /></td>
                <td className="py-2.5 text-right text-slate-500 tabular-nums whitespace-nowrap">
                  {t.submitted_at ? new Date(t.submitted_at).toLocaleString() : "--"}
                </td>
                <td className="py-2.5 text-right text-slate-500 tabular-nums whitespace-nowrap pr-0">
                  {t.filled_at ? new Date(t.filled_at).toLocaleString() : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function BacktestTradesTable({ trades }) {
  if (!trades?.length) return null;
  const columns = Object.keys(trades[0]);
  const TH = "py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-slate-700/50 text-right first:text-left";

  return (
    <div
      className="rounded-xl p-6 overflow-x-auto"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">Lumibot</p>
          <h2 className="text-sm font-semibold text-slate-100">Backtest Trade Log</h2>
          <p className="text-xs text-slate-600 mt-0.5">From most recent sarsa-v1 backtest run</p>
        </div>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
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
              style={{ backgroundColor: idx % 2 === 0 ? "rgba(30,41,59,0.2)" : "transparent" }}
            >
              {columns.map((col, ci) => (
                <td
                  key={col}
                  className={`py-2 ${ci === 0 ? "pl-0 text-left text-slate-300 font-medium" : "text-right text-slate-400"} pr-4 last:pr-0 tabular-nums whitespace-nowrap`}
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

export default function Trades() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await fetchTrades();
      setData(d);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Could not reach the backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title="Trades" lastUpdated={lastUpdated} onRefresh={load} />

      <main className="pt-14 px-6 py-6 space-y-6 max-w-screen-xl">
        {/* Page header */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
            Order History
          </p>
          <h2 className="text-lg font-bold text-slate-100">Trades</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live Alpaca paper orders and backtest trade log
          </p>
        </div>

        {/* Error */}
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

        {/* Skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-64 rounded-xl bg-slate-800/40 animate-pulse" />
            <div className="h-64 rounded-xl bg-slate-800/40 animate-pulse" />
          </div>
        )}

        {/* Live trades */}
        {!loading && data && <LiveTradesTable trades={data.live ?? []} />}

        {/* Backtest trades */}
        {!loading && data && <BacktestTradesTable trades={data.backtest ?? []} />}
      </main>
    </div>
  );
}
