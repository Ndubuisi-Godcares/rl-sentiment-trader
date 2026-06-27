import { useState, useCallback, useEffect, useRef } from "react";
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
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
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
                style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border)" }}
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

// Source badge text uses CSS vars so colours adapt across themes
const SOURCE_COLORS = {
  benzinga:  { bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)", text: "var(--c-warn)" },
  reuters:   { bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.25)", text: "var(--c-accent)" },
  "the fly": { bg: "var(--c-chip-bg)",      border: "var(--c-border)",       text: "var(--c-accent)" },
  default:   { bg: "rgba(51,65,85,0.20)",   border: "rgba(71,85,105,0.3)",   text: "var(--c-text3)" },
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

// ─── Inline markdown renderer (headings + bold) ──────────────────────────────
function renderInsight(text) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <p key={i} className="text-[11px] font-bold uppercase tracking-widest text-indigo-300 mt-3 mb-1">
          {line.slice(3)}
        </p>
      );
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} className="text-xs text-slate-300 leading-relaxed">
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j} className="text-slate-100 font-semibold">{p.slice(2, -2)}</strong>
            : p
        )}
      </p>
    );
  });
}

// ─── Per-article AI Insight ───────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

function ArticleInsight({ article, symbol }) {
  const [open,      setOpen]      = useState(false);
  const [insight,   setInsight]   = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error,     setError]     = useState(null);
  const accumulated = useRef("");

  const fetchInsight = async () => {
    if (streaming) return;
    if (insight) { setOpen((o) => !o); return; }
    setOpen(true);
    setStreaming(true);
    setError(null);
    accumulated.current = "";

    try {
      const res = await fetch(`${BASE_URL}/analysis/news-explain`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline:    article.headline,
          sentiment:   article.sentiment ?? "neutral",
          probability: article.probability ?? null,
          symbol:      symbol ?? "SPY",
          source:      article.source ?? null,
          published:   article.published ?? null,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rafId  = 0;
      const flush = () => {
        setInsight(accumulated.current);
        rafId = 0;
      };

      outer: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break outer;
          let parsed;
          try { parsed = JSON.parse(raw); } catch { continue; }
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            accumulated.current += parsed.text;
            if (!rafId) rafId = requestAnimationFrame(flush);
          }
        }
      }
      if (rafId) cancelAnimationFrame(rafId);
      setInsight(accumulated.current);
    } catch (e) {
      setError(e.message ?? "Failed to get insight.");
    } finally {
      setStreaming(false);
    }
  };

  const sentCfg = SENTIMENT_CONFIG[article.sentiment] ?? SENTIMENT_CONFIG.neutral;

  return (
    <div className="mt-2">
      <button
        onClick={fetchInsight}
        disabled={streaming}
        className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border transition-all hover:brightness-110 disabled:opacity-50"
        style={{
          backgroundColor: "var(--c-chip-bg)",
          borderColor:     "var(--c-border)",
          color:           "var(--c-accent)",
        }}
      >
        {streaming ? (
          <>
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Analyzing…
          </>
        ) : insight ? (
          open ? "▲ Hide Insight" : "▼ Show Insight"
        ) : (
          <>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            AI Insight
          </>
        )}
      </button>

      {open && (insight || error) && (
        <div
          className="mt-2 rounded-lg p-4 space-y-1"
          style={{
            backgroundColor: "rgba(99,102,241,0.05)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ backgroundColor: `${sentCfg.barColor}20`, color: sentCfg.barColor }}
            >
              FinBERT {article.sentiment ?? "neutral"}
            </span>
            <span className="text-[9px] text-slate-600">SARSA Market Impact Analysis</span>
            {streaming && (
              <span className="ml-auto text-[9px] text-indigo-400 animate-pulse">streaming…</span>
            )}
          </div>
          {error
            ? <p className="text-xs text-red-400">{error}</p>
            : renderInsight(insight)
          }
        </div>
      )}
    </div>
  );
}

function ArticleList({ articles, symbol }) {
  if (!articles?.length) return null;
  return (
    <div
      className="rounded-xl p-6"
      style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
            Source Data
          </p>
          <h2 className="text-sm font-semibold text-slate-100">Analyzed Articles</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Alpaca Markets feed (Benzinga · Reuters) — click AI Insight for market impact analysis
          </p>
        </div>
        <span
          className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ color: "var(--c-accent)", backgroundColor: "var(--c-chip-bg)", borderColor: "var(--c-border)" }}
        >
          {articles.length} articles
        </span>
      </div>

      <ul className="space-y-3">
        {articles.map((a, i) => {
          const style = sourceBadgeStyle(a.source);
          const sentCfg = SENTIMENT_CONFIG[a.sentiment] ?? SENTIMENT_CONFIG.neutral;
          return (
            <li
              key={i}
              className="rounded-lg p-4 flex flex-col gap-2"
              style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
            >
              {/* Top row: index + source badge + sentiment + date */}
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

                {a.sentiment && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ backgroundColor: `${sentCfg.barColor}18`, color: sentCfg.barColor }}
                  >
                    {sentCfg.icon} {a.sentiment}
                    {a.probability ? ` ${Math.round(a.probability * 100)}%` : ""}
                  </span>
                )}

                {a.published && (
                  <span className="text-[10px] text-slate-500 tabular-nums ml-auto flex-shrink-0">
                    {fmtDate(a.published)}
                  </span>
                )}
              </div>

              {/* Headline */}
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
                        style={{ backgroundColor: "var(--c-chip-bg)", color: "var(--c-accent)" }}
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* AI Insight — per article streaming explanation */}
              <ArticleInsight article={a} symbol={symbol} />
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
          style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
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
            <ArticleList articles={data.articles} symbol={symbol} />
          </>
        )}

        {/* Idle state */}
        {!loading && !data && !error && (
          <div
            className="rounded-xl p-12 flex flex-col items-center gap-3 text-slate-600"
            style={{ backgroundColor: "var(--c-bg2)", border: "1px solid var(--c-border)" }}
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
