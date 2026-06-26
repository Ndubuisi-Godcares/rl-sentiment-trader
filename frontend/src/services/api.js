import axios from "axios";

// In dev: VITE_API_URL is unset, so requests go through Vite's /api proxy.
// In production: VITE_API_URL points to the HF Spaces backend URL directly.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? "/api" });

export const fetchPortfolio = () => api.get("/portfolio").then((r) => r.data);
export const fetchMetrics   = () => api.get("/metrics").then((r) => r.data);
export const fetchPositions = () => api.get("/positions").then((r) => r.data);
export const fetchSentiment = (symbol = "SPY", lookbackDays = 3) =>
  api.get("/sentiment", { params: { symbol, lookback_days: lookbackDays } }).then((r) => r.data);
export const fetchTrades    = () => api.get("/trades").then((r) => r.data);
export const fetchBacktest    = () => api.get("/backtest").then((r) => r.data);
export const fetchLearning    = () => api.get("/backtest/learning").then((r) => r.data);
export const fetchComparison  = () => api.get("/comparison").then((r) => r.data);
export const runBacktest = (startDate, endDate, symbol = "SPY", { walkForward = false, symbols = null } = {}) =>
  api.post("/backtest/run", {
    start_date:   startDate,
    end_date:     endDate,
    symbol,
    ...(symbols && symbols.length > 1 ? { symbols } : {}),
    walk_forward: walkForward,
  }).then((r) => r.data);
