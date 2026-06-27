import { useState, useEffect } from "react";
import ThemeSwitcher from "./ThemeSwitcher";
import { useTheme } from "../context/ThemeContext";

function checkMarketOpen() {
  const et  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day  = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export default function Topbar({ title = "Dashboard", lastUpdated = null, onRefresh }) {
  const [marketOpen, setMarketOpen] = useState(checkMarketOpen);
  const { symbol = "SPY", isLight } = useTheme() ?? {};

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
        backgroundColor: "var(--c-topbar)",
        backdropFilter: "blur(14px) saturate(180%)",
        borderBottom: "1px solid var(--c-topbar-border)",
      }}
    >
      {/* Left: title */}
      <div className="flex items-center gap-3">
        <h1
          className="text-sm font-semibold tracking-tight"
          style={{ color: "var(--c-text1)" }}
        >
          {title}
        </h1>
        <span style={{ color: "var(--c-text3)" }} className="hidden sm:inline text-xs">·</span>
        <span style={{ color: "var(--c-text3)" }} className="hidden sm:inline text-xs">
          {symbol} · FinBERT + SARSA
        </span>
      </div>

      {/* Right: status + time + theme + refresh */}
      <div className="flex items-center gap-3">
        {/* Market status */}
        <div
          className="market-badge hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{
            backgroundColor: "var(--c-topbar-item)",
            border: "1px solid var(--c-topbar-border)",
          }}
        >
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
          <span
            className="text-xs tabular-nums hidden md:inline"
            style={{ color: "var(--c-text3)" }}
          >
            Updated {timeLabel}
          </span>
        )}

        <ThemeSwitcher />

        {/* Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
            style={{ backgroundColor: "#6366f1" }}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z" clipRule="evenodd" />
              <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z" />
            </svg>
            Refresh
          </button>
        )}
      </div>
    </header>
  );
}
