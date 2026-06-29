import { useEffect, useState, useCallback } from "react";
import { fetchPortfolio, fetchMetrics, fetchPositions, fetchSentiment } from "../services/api";
import SymbolPicker from "../components/SymbolPicker";
import { useTheme } from "../context/ThemeContext";
import Topbar from "../components/Topbar";
import MetricCard from "../components/MetricCard";
import EquityChart from "../components/EquityChart";
import PositionsTable from "../components/PositionsTable";
import SentimentWidget from "../components/SentimentWidget";

const fmt$ = (n) =>
  n == null
    ? "--"
    : "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n) =>
  n == null ? "--" : (n >= 0 ? "+" : "") + Number(n).toFixed(2) + "%";

/**
 * Pull a named metric from the /metrics stats dict.
 * lumibot's stats CSV uses the metric name as the index and strategy/benchmark
 * as columns. We accept any case-insensitive partial match.
 */
function extractStat(stats, fragmentOrFragments, column = 0) {
  if (!stats) return null;
  const cols = Object.keys(stats);
  const col = cols[column] ?? cols[0];
  if (!col) return null;
  const rows = stats[col];
  const fragments = Array.isArray(fragmentOrFragments) ? fragmentOrFragments : [fragmentOrFragments];
  for (const frag of fragments) {
    const key = Object.keys(rows).find((k) => k.toLowerCase().includes(frag.toLowerCase()));
    if (key != null) return rows[key];
  }
  return null;
}

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-3">
      {children}
    </p>
  );
}

export default function Dashboard() {
  const [portfolio, setPortfolio]     = useState(null);
  const [metrics, setMetrics]         = useState(null);
  const [positions, setPositions]     = useState([]);
  const [sentiment, setSentiment]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { symbol, setSymbol }         = useTheme();

  const load = useCallback(async (sym) => {
    setError(null);
    try {
      const [port, met, pos, sent] = await Promise.allSettled([
        fetchPortfolio(),
        fetchMetrics(),
        fetchPositions(),
        fetchSentiment(sym),
      ]);

      if (port.status === "fulfilled") setPortfolio(port.value);
      if (met.status  === "fulfilled") setMetrics(met.value);
      if (pos.status  === "fulfilled") setPositions(pos.value);
      if (sent.status === "fulfilled") setSentiment(sent.value);

      const rejected = [port, met, pos, sent].filter((r) => r.status === "rejected");
      if (rejected.length === 4) setError("Could not reach the backend. Is it running?");

      setLastUpdated(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch whenever the globally selected symbol changes
  useEffect(() => { load(symbol); }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSymbolChange = (s) => {
    setSymbol(s); // ThemeContext update triggers the useEffect above
  };

  const live = portfolio?.live;
  const stats = metrics?.stats;
  const series = portfolio?.backtest_series ?? [];
  const lastBar = series.length ? series[series.length - 1] : null;

  const STARTING_BUDGET = 100_000;
  // Prefer backtest total return (from tearsheet) over live paper account return
  const backtestReturnStr = extractStat(stats, ["total return", "cum. return", "cumulative return"]);
  const totalReturnPct = backtestReturnStr != null
    ? parseFloat(backtestReturnStr)
    : (live?.portfolio_value != null
        ? ((live.portfolio_value - STARTING_BUDGET) / STARTING_BUDGET) * 100
        : null);

  return (
    <div className="min-h-screen text-slate-100">
      {/* Fixed topbar — sits above main content */}
      <Topbar title="Dashboard" lastUpdated={lastUpdated} onRefresh={() => load(symbol)} />

      {/* Content area — offset for topbar height (56px = h-14) */}
      <main
        className="pt-14 px-6 py-6 space-y-8 max-w-screen-xl"
        style={{ marginLeft: 0 }}
      >
        {/* Error banner */}
        {error && (
          <div
            className="rounded-xl px-5 py-3 text-sm text-red-300 flex items-start gap-3"
            style={{
              backgroundColor: "rgba(127,29,29,0.2)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            {error}
          </div>
        )}

        {/* KPI cards section */}
        <section>
          <SectionLabel>Key Metrics</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Initial Capital"
              value={fmt$(STARTING_BUDGET)}
              sub="Starting budget"
              loading={loading}
            />
            <MetricCard
              label="Portfolio Value"
              value={fmt$(lastBar?.portfolio_value)}
              sub="Backtest final value"
              loading={loading}
            />
            <MetricCard
              label={`Invested in ${symbol}`}
              value={fmt$(lastBar != null ? lastBar.portfolio_value - lastBar.cash : null)}
              sub="In open position"
              loading={loading}
            />
            <MetricCard
              label="Cash Balance"
              value={fmt$(lastBar?.cash)}
              sub="Uninvested cash"
              loading={loading}
            />
            <MetricCard
              label="Total Return"
              value={fmtPct(totalReturnPct)}
              sub="Backtest result"
              color={totalReturnPct >= 0 ? "text-emerald-400" : "text-red-400"}
              loading={loading}
            />
            <MetricCard
              label="CAGR"
              value={extractStat(stats, "cagr") ?? "--"}
              sub="Backtest result"
              loading={loading}
            />
            <MetricCard
              label="Sharpe Ratio"
              value={extractStat(stats, "sharpe") ?? "--"}
              loading={loading}
            />
            <MetricCard
              label="Max Drawdown"
              value={extractStat(stats, "drawdown") ?? "--"}
              color="text-red-400"
              loading={loading}
            />
          </div>
        </section>

        {/* Equity chart section */}
        <section>
          <SectionLabel>Performance</SectionLabel>
          <EquityChart data={portfolio?.backtest_series ?? []} />
        </section>

        {/* Positions + Sentiment section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Positions &amp; Signal</SectionLabel>
            <SymbolPicker
              value={symbol}
              onChange={handleSymbolChange}
              disabled={loading}
              size="sm"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <PositionsTable positions={positions} loading={loading} />
            </div>
            <SentimentWidget data={sentiment} loading={loading} symbol={symbol} />
          </div>
        </section>
      </main>
    </div>
  );
}
