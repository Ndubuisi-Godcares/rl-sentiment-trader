/**
 * Shows the current FinBERT sentiment signal for SPY.
 *
 * Props:
 *   data     object  — response from GET /sentiment
 *   loading  bool
 */

const SENTIMENT_CONFIG = {
  positive: {
    label: "Positive",
    icon: "▲",
    barColor: "#34d399",       // emerald-400
    badgeText: "text-emerald-300",
    badgeBg: "bg-emerald-900/30",
    badgeBorder: "border-emerald-700/40",
    glowColor: "rgba(52,211,153,0.12)",
  },
  negative: {
    label: "Negative",
    icon: "▼",
    barColor: "#f87171",       // red-400
    badgeText: "text-red-300",
    badgeBg: "bg-red-900/30",
    badgeBorder: "border-red-700/40",
    glowColor: "rgba(248,113,113,0.12)",
  },
  neutral: {
    label: "Neutral",
    icon: "—",
    barColor: "#6366f1",       // indigo-500
    badgeText: "text-slate-300",
    badgeBg: "bg-slate-700/40",
    badgeBorder: "border-slate-600/40",
    glowColor: "rgba(99,102,241,0.08)",
  },
};

export default function SentimentWidget({ data, loading = false, symbol = "SPY" }) {
  const cfg = SENTIMENT_CONFIG[data?.sentiment] ?? SENTIMENT_CONFIG.neutral;
  const confidencePct = data?.probability != null ? Math.round(data.probability * 100) : 0;

  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-5 relative overflow-hidden"
      style={{
        backgroundColor: "var(--c-bg2)",
        border: "1px solid var(--c-border)",
      }}
    >
      {/* Background glow */}
      {!loading && (
        <span
          className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full"
          style={{ background: cfg.glowColor, filter: "blur(24px)" }}
        />
      )}

      {/* Section label */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
          Sentiment Signal
        </p>
        <h2 className="text-sm font-semibold text-slate-100">Current Sentiment — {symbol}</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-12 w-36 bg-slate-700/50 rounded-xl animate-pulse" />
          <div className="h-2 w-full bg-slate-700/50 rounded-full animate-pulse" />
          <div className="h-24 bg-slate-700/30 rounded-lg animate-pulse" />
        </div>
      ) : (
        <>
          {/* Large centred sentiment label */}
          <div className="flex flex-col items-center gap-2 py-2">
            <span
              className={`text-4xl font-black tracking-tighter ${cfg.badgeText}`}
              style={{ lineHeight: 1 }}
            >
              {cfg.icon}
            </span>
            <span
              className={`text-lg font-bold tracking-tight ${cfg.badgeText}`}
            >
              {cfg.label}
            </span>
            {/* Badge pill */}
            <span
              className={`text-[10px] font-semibold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${cfg.badgeText} ${cfg.badgeBg} ${cfg.badgeBorder}`}
            >
              FinBERT Signal
            </span>
          </div>

          {/* Confidence bar */}
          {data && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Confidence</span>
                <span className="text-xs font-bold tabular-nums text-slate-200">
                  {confidencePct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full rounded-full bar-transition"
                  style={{
                    width: `${confidencePct}%`,
                    backgroundColor: cfg.barColor,
                    boxShadow: `0 0 8px ${cfg.barColor}60`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Stats row */}
          {data && (
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
                style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
              >
                <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Confidence</span>
                <span className="text-sm font-bold tabular-nums text-slate-100">{confidencePct}%</span>
              </div>
              <div
                className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
                style={{ backgroundColor: "var(--c-bg)", border: "1px solid var(--c-border-s)" }}
              >
                <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Articles</span>
                <span className="text-sm font-bold tabular-nums text-slate-100">{data.headline_count ?? "--"}</span>
              </div>
            </div>
          )}

          {/* Headlines — scrollable list (uses articles if available, falls back to headlines) */}
          {(() => {
            const items = data?.articles?.length
              ? data.articles.map((a) => ({ text: a.headline, source: a.source, published: a.published, url: a.url }))
              : data?.headlines?.length
              ? data.headlines.map((h) => ({ text: h }))
              : [];
            if (!items.length) return null;
            return (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 mb-2">
                  Recent Headlines
                </p>
                <ul
                  className="space-y-2 max-h-48 overflow-y-auto pr-1"
                  style={{ scrollbarGutter: "stable" }}
                >
                  {items.map((item, i) => (
                    <li key={i} className="flex flex-col gap-0.5">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-slate-400 leading-snug hover:text-indigo-300 transition-colors"
                        >
                          {item.text}
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400 leading-snug">{item.text}</span>
                      )}
                      {(item.source || item.published) && (
                        <span className="text-[9px] text-slate-600">
                          {item.source && <span className="uppercase tracking-widest">{item.source}</span>}
                          {item.source && item.published && " · "}
                          {item.published && new Date(item.published).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
