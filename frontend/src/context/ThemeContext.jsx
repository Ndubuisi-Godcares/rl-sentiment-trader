import { createContext, useContext, useState } from "react";

export const THEMES = {
  midnight: { name: "Midnight", bg: "#020617",                                                              dot: "#6366f1", desc: "Classic dark"   },
  ocean:    { name: "Ocean",    bg: "linear-gradient(160deg,#020b18 0%,#041828 60%,#020b18 100%)",          dot: "#0ea5e9", desc: "Deep blue"      },
  dusk:     { name: "Dusk",     bg: "linear-gradient(160deg,#0d0521 0%,#170a35 60%,#0d0521 100%)",          dot: "#a855f7", desc: "Indigo night"   },
  forest:   { name: "Forest",   bg: "linear-gradient(160deg,#020d08 0%,#071a0f 60%,#020d08 100%)",          dot: "#10b981", desc: "Dark green"     },
  graphite: { name: "Graphite", bg: "linear-gradient(160deg,#0a0a0a 0%,#161616 60%,#0a0a0a 100%)",         dot: "#94a3b8", desc: "Neutral dark"   },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("sarsa-theme") ?? "midnight"
  );
  const [symbol, setSymbolState] = useState(
    () => localStorage.getItem("sarsa-symbol") ?? "SPY"
  );

  const setTheme = (t) => {
    setThemeState(t);
    localStorage.setItem("sarsa-theme", t);
  };

  const setSymbol = (s) => {
    setSymbolState(s);
    localStorage.setItem("sarsa-symbol", s);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, symbol, setSymbol }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
