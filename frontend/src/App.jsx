import { Routes, Route } from "react-router-dom";
import { ThemeProvider, useTheme, THEMES } from "./context/ThemeContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Backtest from "./pages/Backtest";
import Sentiment from "./pages/Sentiment";
import Trades from "./pages/Trades";
import Comparison from "./pages/Comparison";
import Analysis from "./pages/Analysis";
import AIReport from "./pages/AIReport";

function AppInner() {
  const { theme } = useTheme();
  return (
    <div
      className="flex min-h-screen"
      style={{ background: THEMES[theme]?.bg ?? "#020617", color: "var(--c-text1)" }}
    >
      <Sidebar />
      <div className="flex-1" style={{ marginLeft: "220px" }}>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/backtest"   element={<Backtest />} />
          <Route path="/sentiment"  element={<Sentiment />} />
          <Route path="/trades"     element={<Trades />} />
          <Route path="/comparison" element={<Comparison />} />
          <Route path="/analysis"   element={<Analysis />} />
          <Route path="/ai-report"  element={<AIReport />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
