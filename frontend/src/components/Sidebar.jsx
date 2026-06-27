import { NavLink } from "react-router-dom";
import { useTheme, THEMES, LIGHT_THEMES } from "../context/ThemeContext";

const NAV_ITEMS = [
  {
    label: "Dashboard", to: "/", end: true,
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 3a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm9 0a1 1 0 011-1h5a1 1 0 011 1v2a1 1 0 01-1 1h-5a1 1 0 01-1-1V3zm0 7a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1h-5a1 1 0 01-1-1v-7zM2 12a1 1 0 011-1h6a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5z" /></svg>,
  },
  {
    label: "Backtest", to: "/backtest",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" /></svg>,
  },
  {
    label: "Sentiment", to: "/sentiment",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
  },
  {
    label: "Trade Log", to: "/trades",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 000 2h14a1 1 0 100-2H3zm0 4a1 1 0 100 2h6a1 1 0 100-2H3z" clipRule="evenodd" /></svg>,
  },
  {
    label: "Benchmark", to: "/comparison",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>,
  },
  {
    label: "Analysis", to: "/analysis",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v6a1 1 0 102 0V8z" clipRule="evenodd" /></svg>,
  },
  {
    label: "Research Report", to: "/ai-report",
    badge: "XAI",
    icon: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>,
  },
];

const DARK_NAV  = ["Dashboard", "Backtest", "Sentiment", "Trade Log"];
const LIGHT_NAV = ["Benchmark", "Analysis", "Research Report"];

export default function Sidebar() {
  const { theme, symbol = "SPY" } = useTheme() ?? {};
  const dot   = THEMES[theme]?.dot   ?? "#6366f1";
  const isLight = LIGHT_THEMES.has(theme);

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-40 overflow-hidden"
      style={{
        width: "220px",
        backgroundColor: "var(--c-sidebar)",
        borderRight: "1px solid var(--c-sidebar-border)",
      }}
    >
      {/* ── Decorative background glows ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isLight
            ? `radial-gradient(ellipse 180% 120% at 50% -20%, ${dot}18 0%, transparent 65%)`
            : `radial-gradient(ellipse 180% 120% at 50% -20%, ${dot}22 0%, transparent 65%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
        style={{
          background: `linear-gradient(to top, ${dot}0a 0%, transparent 100%)`,
        }}
      />

      {/* ── Brand ── */}
      <div
        className="relative flex items-center gap-3 px-5 py-5"
        style={{ borderBottom: "1px solid var(--c-sidebar-border)" }}
      >
        {/* Animated brand dot */}
        <div className="relative flex-shrink-0">
          <span
            className="relative flex h-6 w-6 items-center justify-center rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${dot}, ${dot}bb)`,
              boxShadow: `0 0 16px ${dot}55`,
            }}
          >
            <svg viewBox="0 0 12 12" fill="white" className="w-3.5 h-3.5 opacity-90">
              <path d="M6 1l1.5 3.5L11 5.5 8.5 8l.6 3.5L6 10 3 11.5l.5-3.5L1 5.5l3.5-1z" />
            </svg>
          </span>
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: dot, boxShadow: `0 0 6px ${dot}` }}
          />
        </div>

        <div className="min-w-0">
          <span
            className="block text-[11px] font-black tracking-[0.18em] uppercase truncate"
            style={{ color: "var(--c-brand-text)" }}
          >
            QuantSentinel
          </span>
          <span
            className="block text-[9px] tracking-widest uppercase truncate mt-0.5"
            style={{ color: `${dot}99` }}
          >
            {symbol} · AI Research
          </span>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="relative flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">

        {/* Primary nav group */}
        <p
          className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 pb-2"
          style={{ color: `${dot}60` }}
        >
          Research
        </p>
        {NAV_ITEMS.slice(0, 4).map((item) => <NavItem key={item.label} item={item} dot={dot} />)}

        {/* Divider */}
        <div className="py-2 px-3">
          <div className="h-px" style={{ backgroundColor: "var(--c-sidebar-border)" }} />
        </div>

        {/* Analytics group */}
        <p
          className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 pb-2"
          style={{ color: `${dot}60` }}
        >
          Analytics
        </p>
        {NAV_ITEMS.slice(4).map((item) => <NavItem key={item.label} item={item} dot={dot} />)}
      </nav>

      {/* ── Footer ── */}
      <div
        className="relative px-5 py-4"
        style={{ borderTop: "1px solid var(--c-sidebar-border)" }}
      >
        {/* Live indicator */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="pulse-live absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "#34d399" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "#10b981" }} />
          </span>
          <span className="text-[10px] font-medium" style={{ color: "var(--c-brand-text)", opacity: 0.5 }}>
            Alpaca Paper{" "}
            <span className="font-bold" style={{ color: "#34d399", opacity: 1 }}>LIVE</span>
          </span>
        </div>

        {/* Theme dot strip */}
        <ThemeDots currentTheme={theme} />
      </div>
    </aside>
  );
}

function ThemeDots({ currentTheme }) {
  const { setTheme } = useTheme();
  return (
    <div className="flex items-center gap-1.5 mt-3">
      {["midnight","ocean","dusk","forest","graphite","ivory","crystal","white","paper"].map((t) => (
        <button
          key={t}
          title={THEMES[t]?.name}
          onClick={() => setTheme(t)}
          className="w-2 h-2 rounded-full transition-all hover:scale-125 focus:outline-none"
          style={{
            backgroundColor: THEMES[t]?.dot,
            opacity: currentTheme === t ? 1 : 0.30,
            boxShadow: currentTheme === t ? `0 0 6px ${THEMES[t]?.dot}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function NavItem({ item, dot }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
          isActive ? "nav-link-active" : "nav-link-idle border-transparent"
        }`
      }
      style={({ isActive }) =>
        isActive
          ? {
              backgroundColor: "var(--c-nav-active-bg)",
              color: "var(--c-nav-active-text)",
              borderColor: "var(--c-nav-active-border)",
            }
          : { color: "var(--c-brand-text)", opacity: 0.5 }
      }
    >
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? "var(--c-nav-active-text)" : undefined }}>
            {item.icon}
          </span>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span
              className="text-[8px] font-black px-1.5 py-0.5 rounded tracking-widest"
              style={{
                background: `linear-gradient(135deg, ${dot}, ${dot}bb)`,
                color: "white",
                boxShadow: `0 0 8px ${dot}44`,
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
