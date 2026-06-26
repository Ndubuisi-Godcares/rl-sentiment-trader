/**
 * Reusable symbol picker used on Dashboard (sentiment) and Backtest (run target).
 * Selection is persisted to localStorage under key "sarsa-symbol".
 *
 * Props:
 *   value      string  — selected ticker
 *   onChange   fn      — called with new ticker string
 *   disabled   bool    — locks the picker while a job runs
 *   size       "sm"|"md"  — compact vs full width
 */

export const SYMBOLS = [
  // ETFs
  { ticker: "SPY",  name: "S&P 500 ETF",        type: "ETF"   },
  { ticker: "QQQ",  name: "NASDAQ 100 ETF",      type: "ETF"   },
  { ticker: "IWM",  name: "Russell 2000 ETF",    type: "ETF"   },
  { ticker: "DIA",  name: "Dow Jones ETF",        type: "ETF"   },
  { ticker: "GLD",  name: "Gold ETF",             type: "ETF"   },
  // Mega-cap tech
  { ticker: "AAPL", name: "Apple",                type: "Stock" },
  { ticker: "MSFT", name: "Microsoft",            type: "Stock" },
  { ticker: "NVDA", name: "NVIDIA",               type: "Stock" },
  { ticker: "TSLA", name: "Tesla",                type: "Stock" },
  { ticker: "AMZN", name: "Amazon",               type: "Stock" },
  { ticker: "META", name: "Meta",                 type: "Stock" },
  { ticker: "GOOG", name: "Alphabet",             type: "Stock" },
  // Finance
  { ticker: "JPM",  name: "JPMorgan Chase",       type: "Stock" },
  { ticker: "BRK-B",name: "Berkshire Hathaway",  type: "Stock" },
];

// Kept for one-time reads before React tree mounts (e.g. useState initialiser)
export function getStoredSymbol() {
  return localStorage.getItem("sarsa-symbol") ?? "SPY";
}

const TYPE_COLOR = { ETF: "#6ee7b7", Stock: "#818cf8" };

export default function SymbolPicker({ value, onChange, disabled = false, size = "md" }) {
  const current = SYMBOLS.find((s) => s.ticker === value) ?? { ticker: value, name: value, type: "Stock" };
  const typeColor = TYPE_COLOR[current.type] ?? "#94a3b8";

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  if (size === "sm") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Symbol</span>
        <div className="relative">
          <select
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className="appearance-none pl-2 pr-6 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "rgba(30,41,59,0.8)",
              borderColor: "rgba(51,65,85,0.6)",
              color: typeColor,
            }}
          >
            {SYMBOLS.map((s) => (
              <option key={s.ticker} value={s.ticker} style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}>
                {s.ticker}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 10 6" fill="currentColor"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-600 pointer-events-none"
          >
            <path d="M0 0l5 6 5-6H0z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "rgba(30,41,59,0.6)", border: "1px solid rgba(51,65,85,0.5)" }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Symbol</span>
      <div className="relative">
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="appearance-none pl-2 pr-7 py-1 rounded-lg text-sm font-bold border-0 outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "transparent", color: typeColor }}
        >
          {["ETF", "Stock"].map((type) => (
            <optgroup key={type} label={type} style={{ backgroundColor: "#0f172a", color: "#94a3b8" }}>
              {SYMBOLS.filter((s) => s.type === type).map((s) => (
                <option key={s.ticker} value={s.ticker} style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}>
                  {s.ticker} — {s.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg
          viewBox="0 0 10 6" fill="currentColor"
          className="absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-600 pointer-events-none"
        >
          <path d="M0 0l5 6 5-6H0z" />
        </svg>
      </div>
      <span className="text-[9px] font-medium text-slate-600">{current.type}</span>
      <span className="text-xs text-slate-500 truncate max-w-[120px]">{current.name}</span>
    </div>
  );
}
