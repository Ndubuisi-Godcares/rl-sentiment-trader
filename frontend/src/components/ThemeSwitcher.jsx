import { useState } from "react";
import { useTheme, THEMES, LIGHT_THEMES } from "../context/ThemeContext";

const DARK_KEYS  = ["midnight", "ocean", "dusk", "forest", "graphite"];
const LIGHT_KEYS = ["ivory", "crystal", "white"];

function Swatch({ themeKey, current, onClick }) {
  const t      = THEMES[themeKey];
  const active = current === themeKey;
  return (
    <button
      onClick={() => onClick(themeKey)}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all"
      style={{
        backgroundColor: active ? "rgba(99,102,241,0.12)" : "transparent",
        color: active ? "var(--c-text1, #f1f5f9)" : "var(--c-text2, #94a3b8)",
      }}
    >
      {/* Dot with glow on active */}
      <span
        className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10 transition-all"
        style={{
          backgroundColor: t.dot,
          boxShadow: active ? `0 0 8px ${t.dot}88` : "none",
          transform: active ? "scale(1.2)" : "scale(1)",
        }}
      />
      <span className="font-semibold flex-1 text-left">{t.name}</span>
      <span className="text-[10px] opacity-50">{t.desc}</span>
      {active && (
        <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 flex-shrink-0" style={{ color: t.dot }}>
          <path fillRule="evenodd" d="M10.354 3.646a.5.5 0 010 .708l-5 5a.5.5 0 01-.708 0l-2.5-2.5a.5.5 0 01.708-.708L5 8.293l4.646-4.647a.5.5 0 01.708 0z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  );
}

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dot = THEMES[theme]?.dot ?? "#6366f1";
  const isLight = LIGHT_THEMES.has(theme);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
        style={{
          border: "1px solid var(--c-border, rgba(51,65,85,0.5))",
          backgroundColor: "var(--c-topbar-item, rgba(30,41,59,0.6))",
          color: "var(--c-text2, #94a3b8)",
        }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
          style={{ backgroundColor: dot, boxShadow: `0 0 6px ${dot}88` }}
        />
        <span style={{ color: "var(--c-text1)" }}>Theme</span>
        <svg
          viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--c-text3)" }}
        >
          <path d="M1 4l5 5 5-5H1z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-10 z-50 rounded-xl p-3 space-y-1 min-w-[200px]"
            style={{
              backgroundColor: "var(--c-bg-deep, #0f172a)",
              border: "1px solid var(--c-border)",
              boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${dot}18`,
              backdropFilter: "blur(16px)",
            }}
          >
            {/* Dark themes */}
            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em] px-3 pt-1 pb-1.5"
              style={{ color: "var(--c-text3)" }}
            >
              Dark Themes
            </p>
            {DARK_KEYS.map((k) => (
              <Swatch key={k} themeKey={k} current={theme} onClick={(k) => { setTheme(k); setOpen(false); }} />
            ))}

            {/* Divider */}
            <div className="mx-3 my-2 h-px" style={{ backgroundColor: "var(--c-border)" }} />

            {/* Light themes */}
            <div className="flex items-center gap-2 px-3 pb-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--c-text3)" }}>
                Light Themes
              </p>
              <span
                className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "linear-gradient(135deg,#c4873e,#f0c070)", color: "white" }}
              >
                NEW
              </span>
            </div>
            {LIGHT_KEYS.map((k) => (
              <Swatch key={k} themeKey={k} current={theme} onClick={(k) => { setTheme(k); setOpen(false); }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
