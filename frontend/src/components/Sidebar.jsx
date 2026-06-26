/**
 * Fixed left sidebar — 220px wide.
 * Nav items use React Router NavLink so the active route is highlighted automatically.
 */
import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    to: "/",
    end: true, // exact match only
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 3a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm9 0a1 1 0 011-1h5a1 1 0 011 1v2a1 1 0 01-1 1h-5a1 1 0 01-1-1V3zm0 7a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-5a1 1 0 01-1-1v-7zM2 12a1 1 0 011-1h6a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" />
      </svg>
    ),
  },
  {
    label: "Backtest",
    to: "/backtest",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    label: "Sentiment",
    to: "/sentiment",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    label: "Trades",
    to: "/trades",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 100 2h6a1 1 0 100-2H3z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: "vs SPY",
    to: "/comparison",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const { symbol = "SPY" } = useTheme() ?? {};
  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col"
      style={{
        width: "220px",
        backgroundColor: "#0b1120",
        borderRight: "1px solid rgba(51,65,85,0.5)",
        zIndex: 40,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800/60">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: "#6366f1" }}
        />
        <span className="text-sm font-bold tracking-widest text-slate-100 uppercase">
          SARSA Trader
        </span>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-6 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
          Navigation
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const label = item.to === "/comparison" ? "vs B&H" : item.label;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? "text-indigo-400" : "text-slate-600"}>
                    {item.icon}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Connection status */}
      <div className="px-5 py-5 border-t border-slate-800/60">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="pulse-live absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs text-slate-500">
            Alpaca Paper <span className="text-emerald-400 font-medium">LIVE</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
