/**
 * Fixed top bar — spans the content area to the right of the sidebar.
 *
 * Props:
 *   title        string   — page title
 *   lastUpdated  Date|null
 *   onRefresh    function
 */
import { useState, useEffect } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import { useTheme } from "../context/ThemeContext";

/** Returns true if US stock market is currently open (Mon–Fri 9:30–16:00 ET). */
function checkMarketOpen() {
  const etStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etStr);
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export default function Topbar({ title = "Dashboard", lastUpdated = null, onRefresh }) {
  const [marketOpen, setMarketOpen] = useState(checkMarketOpen);
  const { symbol = "SPY" } = useTheme() ?? {};

  // Re-check every minute
  useEffect(() => {
    const id = setInterval(() => setMarketOpen(checkMarketOpen()), 60_000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <header
      className="fixed top-0 right-0 flex items-center justify-between px-6 h-14 z-30"
      style={{
        left: "220px",
        backgroundColor: "rgba(2,6,23,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(51,65,85,0.4)",
      }}
    >
      {/* Left: title + sub */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h1>
        <span className="hidden sm:inline text-slate-700 text-xs">·</span>
        <span className="hidden sm:inline text-xs text-slate-600">{symbol} · FinBERT + SARSA</span>
      </div>

      {/* Right: market status + time + theme + refresh */}
      <div className="flex items-center gap-3">
        {/* Dynamic market status badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/50">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              marketOpen ? "bg-emerald-400 pulse-live" : "bg-amber-400"
            }`}
          />
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest ${
              marketOpen ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {marketOpen ? "Market Open" : "Market Closed"}
          </span>
        </div>

        {/* Last updated */}
        {timeLabel && (
          <span className="text-xs text-slate-600 tabular-nums hidden md:inline">
            Updated {timeLabel}
          </span>
        )}

        <ThemeSwitcher />

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
          style={{ backgroundColor: "#6366f1" }}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path
              fillRule="evenodd"
              d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z"
              clipRule="evenodd"
            />
            <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
}
