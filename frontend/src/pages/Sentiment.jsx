import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import Topbar from "../components/Topbar";
import SymbolPicker from "../components/SymbolPicker";
import { useTheme } from "../context/ThemeContext";

const api = axios.create({ baseURL: "/api" });

const LOOKBACK_OPTIONS = [3, 7, 14, 30, 60];

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positive",
    icon: "▲",
    color: "text-emerald-400",
    barColor: "#34d399",
    badgeBg: "bg-emerald-900/30",
    badgeBorder: "border-emerald-700/40",
    glow: "rgba(52,211,153,0.12)",
  },
  negative: {
    label: "Negative",
    icon: "▼",
    color: "text-red-400",
    barColor: "#f87171",
    badgeBg: "bg-red-900/30",
    badgeBorder: "border-red-700/40",
    glow: "rgba(248,113,113,0.12)",
  },
  neutral: {
    label: "Neutral",
    icon: "—",
    color: "text-slate-400",
    barColor: "#6366f1",
    badgeBg: "bg-slate-700/40",
    badgeBorder: "border-slate-600/40",
    glow: "rgba(99,102,241,0.08)",
  },
};

function SentimentCard({ data }) {
  const cfg = SENTIMENT_CONFIG[data.sentiment] ?? SENTIMENT_CONFIG.neutral;
  const pct = Math.round((data.probability ?? 0) * 100);

  return (
    <div
      className="rounded-xl p-6 relative overflow-hidden"
      style={{ backgroundColor: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.5)" }}
    >
      {/* Glow */}
      <span
        className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full"
        style={{ background: cfg.glow, filter: "blur(32px)" }}
      />

      <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8 items-center">
        {/* Large sentiment indicator */}
        <div className="flex flex-col items-center gap-2">
          <span className={`text-6xl font-black leading-none ${cfg.color}`}>{cfg.icon}</span>
          <span className={`text-2xl font-bold tracking-tight ${cfg.color}`}>{cfg.label}</span>
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${cfg.color} ${cfg.badgeBg} ${cfg.badgeBorder}`}
          >
            FinBERT Signal
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-4 sm:col-span-2">
          {/* Confidence bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-500">Model Confidence</span>
              <span className="text-slate-200 tabular-nums font-bold">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden">
              <div
                className="h-full rounded-full bar-transition"
                style={{
                  width: `${pct}%`,
                  backgroundColor: cfg.barColor,
                  boxShadow: `0 0 10px ${cfg.barColor}60`,
                }}
              />
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Confidence", value: `${pct}%` },
              { label: "Headlines Analyzed", value: data.headline_count ?? "--" },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg px-4 py-3 flex flex-col gap-0.5"
                style={{ backgroundColor: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.4)" }}
              >
                <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{label}</span>
                <span className="text-xl font-bold tabular-nums text-slate-100">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCE_COLORS = {
  benzinga:     { bg: "rgba(251,191,36,0.12)",  border: "rgba(251,191,36,0.3)",  text: "#fbbf24" },
  reuters:      { bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.3)",  text: "#60a5fa" },
  "the fly":    { bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)",  text: "#818cf8" },
  default:      { bg: "rgba(51,65,85,0.3)",     border: "rgba(71,85,105,0.4)",   text: "#94a3b8" },
};

function sourceBadgeStyle(source) {
  const key = (source || "").toLowerCase();
  return Object.entries(SOURCE_COLORS).find(([k]) => key.includes(k))?.[1] ?? SOURCE_COLORS.default;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ArticleList({ articles }) {
  if (!articles?.length) return null;
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.5)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
            Source Data
          </p>
          <h2 className="text-sm font-semibold text-slate-100">Analyzed Articles</h2>
          <p className="text-xs text-slate-600 mt-0.5">All headlines fed into FinBERT for classification</p>
        </div>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ color: "#818cf8", backgroundColor: "rgba(99,102,241,0.1)", borderColor: "rgba(99,102,241,0.25)" }}
        >
          {articles.length} articles
        </span>
      </div>

      <ul className="space-y-3">
        {articles.map((a, i) => {
          const style = sourceBadgeStyle(a.source);
          return (
            <li
              key={i}
              className="rounded-lg p-4 flex flex-col gap-2"
              style={{ backgroundColor: "rgba(15,23,42,0.5)", border: "1px solid rgba(51,65,85,0.35)" }}
            >
              {/* Top row: index + source badge + date */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-slate-600 bg-slate-800/60 flex-shrink-0">
                  {i + 1}
                </span>

                {a.source && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border flex-shrink-0"
                    style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
                  >
                    {a.source}
                  </span>
                )}

                {a.published && (
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto flex-shrink-0">
                    {fmtDate(a.published)}
                  </span>
                )}
              </div>

              {/* Headline — clickable link */}
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-slate-200 leading-snug font-medium hover:text-indigo-300 transition-colors"
                >
                  {a.headline}
                </a>
              ) : (
                <p className="text-sm text-slate-200 leading-snug font-medium">{a.headline}</p>
              )}

              {/* Summary if available */}
              {a.summary && (
                <p className="text-xs text-slate-500 leading-relaxed">{a.summary}</p>
              )}

              {/* Footer: author + symbols */}
              <div className="flex items-center gap-3 flex-wrap mt-0.5">
                {a.author && (
                  <span className="text-[10px] text-slate-600 flex items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                      <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4z" />
                    </svg>
                    {a.author}
                  </span>
                )}
                {a.symbols?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {a.symbols.map((sym) => (
                      <span
                        key={sym}
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818cf8" }}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Sentiment() {
  const { symbol, setSymbol } = useTheme();
  const [lookback, setLookback] = useState(3);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (sym, days) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/sentiment", { params: { symbol: sym, lookback_days: days } });
      setData(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e?.response?.data?.detail ?? "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-run when symbol or lookback window changes
  useEffect(() => {
    analyze(symbol, lookback);
  }, [symbol, lookback]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    analyze(symbol, lookback);
  };

  const handleSymbolChange = (s) => {
    setSymbol(s); // updates ThemeContext + localStorage; useEffect fires automatically
  };

  return (
    <div className="min-h-screen text-slate-100">
      <Topbar title="Sentiment" lastUpdated={lastUpdated} onRefresh={() => data && analyze()} />

      <main className="pt-14 px-6 py-6 space-y-6 max-w-screen-xl">
        {/* Page header */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600 mb-1">
            FinBERT Analysis
          </p>
          <h2 className="text-lg font-bold text-slate-100">Sentiment Analysis</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Alpaca news headlines classified by FinBERT financial sentiment model
          </p>
        </div>

        {/* Controls */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-5 flex flex-wrap items-end gap-4"
          style={{ backgroundColor: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.5)" }}
        >
          {/* Symbol picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Symbol
            </label>
            <SymbolPicker
              value={symbol}
              onChange={handleSymbolChange}
              disabled={loading}
            />
          </div>

          {/* Lookback selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Lookback Window
            </label>
            <div className="flex gap-1">
              {LOOKBACK_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setLookback(d)}
                  className={[
                    "px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150",
                    lookback === d
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "text-slate-500 border border-slate-700/50 hover:text-slate-300 hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#6366f1" }}
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analyzing…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M9.5 1a.5.5 0 01.5.5v1a.5.5 0 01-.5.5h-3a.5.5 0 01-.5-.5v-1a.5.5 0 01.5-.5h3zm-3 4h3a2 2 0 012 2v3.604l1.224.899A.5.5 0 0113 12H3a.5.5 0 01-.276-.097L4 11.604V7a2 2 0 012-2z" />
                </svg>
                Analyze
              </>
            )}
          </button>

          {/* First-call note */}
          <p className="text-[11px] text-slate-600 self-end pb-0.5">
            First analysis loads FinBERT (~30 s)
          </p>
        </form>

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
            <div className="h-48 rounded-xl bg-slate-800/40 animate-pulse" />
            <div className="h-64 rounded-xl bg-slate-800/40 animate-pulse" />
          </div>
        )}

        {/* Results */}
        {!loading && data && (
          <>
            <SentimentCard data={data} />
            <ArticleList articles={data.articles} />
          </>
        )}

        {/* Idle state */}
        {!loading && !data && !error && (
          <div
            className="rounded-xl p-12 flex flex-col items-center gap-3 text-slate-600"
            style={{ backgroundColor: "rgba(30,41,59,0.4)", border: "1px solid rgba(51,65,85,0.5)" }}
          >
            <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-slate-700">
              <circle cx="20" cy="20" r="14" />
              <path d="M14 20c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" />
              <circle cx="20" cy="20" r="2" fill="currentColor" />
            </svg>
            <p className="text-sm font-medium text-slate-500">Select a symbol and click Analyze</p>
          </div>
        )}
      </main>
    </div>
  );
}
