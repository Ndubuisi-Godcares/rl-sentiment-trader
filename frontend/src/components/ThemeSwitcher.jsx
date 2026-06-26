import { useState } from "react";
import { useTheme, THEMES } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Change theme"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-slate-700/50 transition-all hover:text-slate-200 hover:bg-slate-800/60"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: THEMES[theme]?.dot ?? "#6366f1" }}
        />
        Theme
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-9 z-50 rounded-xl p-2 space-y-0.5 min-w-[170px]"
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid rgba(51,65,85,0.6)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600 px-3 pt-1 pb-1.5">
              Appearance
            </p>
            {Object.entries(THEMES).map(([key, t]) => (
              <button
                key={key}
                onClick={() => { setTheme(key); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                  theme === key
                    ? "bg-slate-700/60 text-slate-100"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: t.dot }}
                />
                <span className="font-medium">{t.name}</span>
                <span className="ml-auto text-[10px] text-slate-600">{t.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
