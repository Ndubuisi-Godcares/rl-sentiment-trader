import { createContext, useContext, useState, useLayoutEffect } from "react";

// ─── Theme definitions ────────────────────────────────────────────────────────

export const LIGHT_THEMES = new Set(["ivory", "crystal", "white", "paper"]);

export const THEMES = {
  // ── Dark themes ──
  midnight: {
    name: "Midnight", dot: "#6366f1", desc: "Classic dark", light: false,
    bg: "#020617",
  },
  ocean: {
    name: "Ocean", dot: "#0ea5e9", desc: "Deep blue", light: false,
    bg: "linear-gradient(160deg,#020b18 0%,#041828 60%,#020b18 100%)",
  },
  dusk: {
    name: "Dusk", dot: "#a855f7", desc: "Indigo night", light: false,
    bg: "linear-gradient(160deg,#0d0521 0%,#170a35 60%,#0d0521 100%)",
  },
  forest: {
    name: "Forest", dot: "#10b981", desc: "Dark green", light: false,
    bg: "linear-gradient(160deg,#020d08 0%,#071a0f 60%,#020d08 100%)",
  },
  graphite: {
    name: "Graphite", dot: "#94a3b8", desc: "Neutral dark", light: false,
    bg: "linear-gradient(160deg,#0a0a0a 0%,#161616 60%,#0a0a0a 100%)",
  },
  // ── Light themes ──
  ivory: {
    name: "Ivory", dot: "#c4873e", desc: "Warm elegant", light: true,
    bg: "linear-gradient(160deg, #fdf9f2 0%, #f5ecda 40%, #fdf9f2 100%)",
  },
  crystal: {
    name: "Crystal", dot: "#6366f1", desc: "Clean premium", light: true,
    bg: "linear-gradient(160deg, #f0f5ff 0%, #e8eeff 50%, #f4f7ff 100%)",
  },
  white: {
    name: "White", dot: "#4f46e5", desc: "Institutional clean", light: true,
    bg: "#f8fafc",
  },
  paper: {
    name: "Paper", dot: "#0ea5e9", desc: "Blueprint blue", light: true,
    bg: "#ffffff",
  },
};

// ─── CSS variable maps ────────────────────────────────────────────────────────

const DARK_BASE = {
  "--c-bg":              "rgba(15,23,42,0.6)",
  "--c-bg2":             "rgba(30,41,59,0.4)",
  "--c-bg3":             "rgba(30,41,59,0.6)",
  "--c-bg-deep":         "rgba(10,16,30,0.8)",
  "--c-border":          "rgba(51,65,85,0.5)",
  "--c-border-s":        "rgba(51,65,85,0.3)",
  "--c-sidebar":         "#0b1120",
  "--c-sidebar-border":  "rgba(51,65,85,0.5)",
  "--c-topbar":          "rgba(2,6,23,0.85)",
  "--c-topbar-border":   "rgba(51,65,85,0.4)",
  "--c-topbar-item":     "rgba(30,41,59,0.6)",
  "--c-text1":           "#f1f5f9",
  "--c-text2":           "#94a3b8",
  "--c-text3":           "#64748b",
  "--c-input":           "rgba(30,41,59,0.6)",
  "--c-nav-active-bg":   "rgba(99,102,241,0.15)",
  "--c-nav-active-text": "#a5b4fc",
  "--c-nav-active-border":"rgba(99,102,241,0.20)",
  "--c-nav-hover-bg":    "rgba(30,41,59,0.5)",
  "--c-brand-text":      "#f1f5f9",
  "--c-status-bg":       "rgba(30,41,59,0.6)",
  "--c-status-border":   "rgba(51,65,85,0.5)",
  "--c-scrollbar":       "#334155",
  "--c-scrollbar-hover": "#475569",
  "--c-shadow":          "rgba(0,0,0,0.0)",
  "--c-glass":           "none",
  // Semantic adaptive colors — use these in inline styles instead of hardcoded hex
  "--c-accent":          "#818cf8",   // indigo-300 on dark, deep indigo on light
  "--c-positive":        "#34d399",   // emerald-400 on dark, emerald-700 on light
  "--c-negative":        "#f87171",   // red-400 on dark, red-600 on light
  "--c-warn":            "#fbbf24",   // amber-400 on dark, amber-700 on light
  "--c-fallback":        "#cbd5e1",   // safe default text
  "--c-chip-bg":         "rgba(99,102,241,0.15)",
  "--c-chip-text":       "#818cf8",
};

const THEME_VARS = {
  midnight: { ...DARK_BASE, "--c-nav-active-bg": "rgba(99,102,241,0.15)", "--c-nav-active-text": "#a5b4fc" },
  ocean:    { ...DARK_BASE, "--c-nav-active-bg": "rgba(14,165,233,0.15)", "--c-nav-active-text": "#7dd3fc" },
  dusk:     { ...DARK_BASE, "--c-nav-active-bg": "rgba(168,85,247,0.15)", "--c-nav-active-text": "#d8b4fe" },
  forest:   { ...DARK_BASE, "--c-nav-active-bg": "rgba(16,185,129,0.15)", "--c-nav-active-text": "#6ee7b7" },
  graphite: { ...DARK_BASE, "--c-nav-active-bg": "rgba(148,163,184,0.15)","--c-nav-active-text": "#cbd5e1" },
  ivory: {
    "--c-bg":              "rgba(255,255,255,0.68)",
    "--c-bg2":             "rgba(253,249,242,0.88)",
    "--c-bg3":             "rgba(255,253,248,0.96)",
    "--c-bg-deep":         "rgba(255,255,255,0.95)",
    "--c-border":          "rgba(180,140,80,0.22)",
    "--c-border-s":        "rgba(180,140,80,0.12)",
    "--c-sidebar":         "#18100a",
    "--c-sidebar-border":  "rgba(60,35,10,0.55)",
    "--c-topbar":          "rgba(253,249,242,0.92)",
    "--c-topbar-border":   "rgba(180,140,80,0.2)",
    "--c-topbar-item":     "rgba(245,235,215,0.75)",
    "--c-text1":           "#1a0f06",
    "--c-text2":           "#6b4520",
    "--c-text3":           "#8a5e30",
    "--c-input":           "rgba(255,253,248,0.96)",
    "--c-nav-active-bg":   "rgba(196,135,62,0.14)",
    "--c-nav-active-text": "#c4873e",
    "--c-nav-active-border":"rgba(196,135,62,0.28)",
    "--c-nav-hover-bg":    "rgba(196,135,62,0.07)",
    "--c-brand-text":      "#f5ecd8",
    "--c-status-bg":       "rgba(245,235,215,0.75)",
    "--c-status-border":   "rgba(180,140,80,0.2)",
    "--c-scrollbar":       "#c4a880",
    "--c-scrollbar-hover": "#a87540",
    "--c-shadow":          "rgba(100,60,10,0.10)",
    "--c-glass":           "blur(12px) saturate(180%)",
    "--c-accent":          "#7c4a0e",   // deeper gold: 7.04:1 on ivory bg
    "--c-positive":        "#166534",   // green-800: 6.79:1 on ivory bg
    "--c-negative":        "#dc2626",   // red-600: 4.60:1 PASS
    "--c-warn":            "#b45309",   // amber-700: 4.78:1 PASS
    "--c-fallback":        "#1a0f06",
    "--c-chip-bg":         "rgba(124,74,14,0.10)",
    "--c-chip-text":       "#7c4a0e",
  },
  crystal: {
    "--c-bg":              "rgba(255,255,255,0.72)",
    "--c-bg2":             "rgba(248,251,255,0.90)",
    "--c-bg3":             "rgba(255,255,255,0.98)",
    "--c-bg-deep":         "rgba(248,251,255,0.98)",
    "--c-border":          "rgba(99,102,241,0.16)",
    "--c-border-s":        "rgba(99,102,241,0.08)",
    "--c-sidebar":         "#0f1623",
    "--c-sidebar-border":  "rgba(51,65,85,0.5)",
    "--c-topbar":          "rgba(244,247,251,0.94)",
    "--c-topbar-border":   "rgba(99,102,241,0.14)",
    "--c-topbar-item":     "rgba(235,238,255,0.8)",
    "--c-text1":           "#0f172a",
    "--c-text2":           "#2d3d5c",
    "--c-text3":           "#4f5f80",
    "--c-input":           "rgba(248,251,255,0.98)",
    "--c-nav-active-bg":   "rgba(129,140,248,0.15)",
    "--c-nav-active-text": "#818cf8",    // indigo-300 — bright enough on dark sidebar (#0f1623), ~6.9:1
    "--c-nav-active-border":"rgba(129,140,248,0.28)",
    "--c-nav-hover-bg":    "rgba(99,102,241,0.06)",
    "--c-brand-text":      "#e2e8f0",
    "--c-status-bg":       "rgba(235,238,255,0.8)",
    "--c-status-border":   "rgba(99,102,241,0.14)",
    "--c-scrollbar":       "#a5b4fc",
    "--c-scrollbar-hover": "#818cf8",
    "--c-shadow":          "rgba(60,70,180,0.08)",
    "--c-glass":           "blur(12px) saturate(160%)",
    "--c-accent":          "#4f46e5",   // indigo-600: 5.75:1 PASS
    "--c-positive":        "#166534",   // green-800: 6.52:1 PASS
    "--c-negative":        "#b91c1c",   // red-700: 5.92:1 PASS
    "--c-warn":            "#92400e",   // amber-800: 6.49:1 PASS
    "--c-fallback":        "#0f172a",
    "--c-chip-bg":         "rgba(79,70,229,0.08)",
    "--c-chip-text":       "#4f46e5",
  },
  white: {
    "--c-bg":              "#ffffff",
    "--c-bg2":             "#f8fafc",
    "--c-bg3":             "#f1f5f9",
    "--c-bg-deep":         "#f8fafc",
    "--c-border":          "#e2e8f0",
    "--c-border-s":        "#f1f5f9",
    "--c-sidebar":         "#0f172a",
    "--c-sidebar-border":  "rgba(255,255,255,0.06)",
    "--c-topbar":          "rgba(255,255,255,0.96)",
    "--c-topbar-border":   "#e2e8f0",
    "--c-topbar-item":     "#f8fafc",
    "--c-text1":           "#0f172a",
    "--c-text2":           "#1e293b",
    "--c-text3":           "#475569",
    "--c-input":           "#ffffff",
    "--c-nav-active-bg":   "rgba(129,140,248,0.12)",
    "--c-nav-active-text": "#818cf8",    // indigo-300 — bright enough on dark sidebar (#0f172a), ~6.9:1
    "--c-nav-active-border":"rgba(129,140,248,0.28)",
    "--c-nav-hover-bg":    "rgba(255,255,255,0.07)",
    "--c-brand-text":      "#f8fafc",
    "--c-status-bg":       "#f8fafc",
    "--c-status-border":   "#e2e8f0",
    "--c-scrollbar":       "#cbd5e1",
    "--c-scrollbar-hover": "#94a3b8",
    "--c-shadow":          "rgba(15,23,42,0.08)",
    "--c-glass":           "none",
    "--c-accent":          "#4f46e5",   // indigo-600: 6.01:1 PASS
    "--c-positive":        "#15803d",   // green-700: 4.79:1 PASS
    "--c-negative":        "#dc2626",   // red-600: 4.62:1 PASS
    "--c-warn":            "#b45309",   // amber-700: 4.80:1 PASS
    "--c-fallback":        "#0f172a",
    "--c-chip-bg":         "rgba(79,70,229,0.07)",
    "--c-chip-text":       "#4f46e5",
  },
  paper: {
    "--c-bg":              "#ffffff",
    "--c-bg2":             "#f0f9ff",
    "--c-bg3":             "#e0f2fe",
    "--c-bg-deep":         "#f0f9ff",
    "--c-border":          "#bae6fd",
    "--c-border-s":        "#e0f2fe",
    "--c-sidebar":         "#0c1a2e",
    "--c-sidebar-border":  "rgba(14,165,233,0.12)",
    "--c-topbar":          "rgba(255,255,255,0.96)",
    "--c-topbar-border":   "#bae6fd",
    "--c-topbar-item":     "#f0f9ff",
    "--c-text1":           "#0c1a2e",
    "--c-text2":           "#1e3a5f",
    "--c-text3":           "#2d5a87",
    "--c-input":           "#ffffff",
    "--c-nav-active-bg":   "rgba(125,211,252,0.15)",
    "--c-nav-active-text": "#7dd3fc",    // sky-300 — bright enough on dark sidebar (#0c1a2e), ~9.3:1
    "--c-nav-active-border":"rgba(125,211,252,0.28)",
    "--c-nav-hover-bg":    "rgba(255,255,255,0.07)",
    "--c-brand-text":      "#e0f2fe",
    "--c-status-bg":       "#f0f9ff",
    "--c-status-border":   "#bae6fd",
    "--c-scrollbar":       "#7dd3fc",
    "--c-scrollbar-hover": "#38bdf8",
    "--c-shadow":          "rgba(12,26,46,0.08)",
    "--c-glass":           "none",
    "--c-accent":          "#0369a1",   // sky-700: 5.93:1 PASS
    "--c-positive":        "#15803d",   // green-700: 5.02:1 PASS
    "--c-negative":        "#dc2626",   // red-600: 4.83:1 PASS
    "--c-warn":            "#b45309",   // amber-700: 5.02:1 PASS
    "--c-fallback":        "#0c1a2e",
    "--c-chip-bg":         "rgba(3,105,161,0.07)",
    "--c-chip-text":       "#0369a1",
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("sarsa-theme") ?? "midnight"
  );
  const [symbol, setSymbolState] = useState(
    () => localStorage.getItem("sarsa-symbol") ?? "SPY"
  );

  // Apply CSS variables to :root whenever theme changes
  useLayoutEffect(() => {
    const vars = THEME_VARS[theme] ?? THEME_VARS.midnight;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));

    // data attribute for CSS class selectors in index.css
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-light", LIGHT_THEMES.has(theme) ? "true" : "false");
  }, [theme]);

  const setTheme = (t) => { setThemeState(t); localStorage.setItem("sarsa-theme", t); };
  const setSymbol = (s) => { setSymbolState(s); localStorage.setItem("sarsa-symbol", s); };

  const isLight = LIGHT_THEMES.has(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, symbol, setSymbol, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }

// Convenience hook — returns style objects using CSS variables so they work with any theme
export function useC() {
  return {
    card:   { backgroundColor: "var(--c-bg)",      border: "1px solid var(--c-border)" },
    raised: { backgroundColor: "var(--c-bg2)",     border: "1px solid var(--c-border)" },
    deep:   { backgroundColor: "var(--c-bg-deep)", border: "1px solid var(--c-border-s)" },
    input:  { backgroundColor: "var(--c-input)",   border: "1px solid var(--c-border)" },
  };
}
