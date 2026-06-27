# QuantSentinel — AI-Powered Stock Trading Platform

A full-stack trading analytics platform combining **SARSA reinforcement learning** with **FinBERT sentiment analysis** to make buy/sell/hold decisions on equities. The system includes a professional React dashboard, a FastAPI backend, and a live paper-trading integration via Alpaca Markets.

---

## Architecture

```
React / Vite Dashboard
        ↓
FastAPI Backend
        ↓
SARSA Trading Engine
        ↓
FinBERT Sentiment Analysis
        ↓
Alpaca Markets API  ·  Yahoo Finance Data
```

---

## Performance (Baseline Backtest 2020 – 2024, SPY)

| Metric | QuantSentinel | SPY Benchmark |
| :--- | :---: | :---: |
| **Cumulative Return** | **80.81%** | 79.08% |
| **CAGR** | **9.35%** | 9.19% |
| **Sharpe Ratio** | **0.47** | 0.41 |
| **Max Drawdown** | **-27.06%** | -33.68% |

> Backtest results are generated via QuantStats and stored in `reports/tearsheet.html`.

---

## Frontend Dashboard

The React/Vite dashboard includes 7 pages and 9 visual themes.

### Pages

| Page | Description |
| :--- | :--- |
| **Dashboard** | Portfolio value, KPI cards, equity curve, open positions, live sentiment signal |
| **Backtest** | Run SARSA backtests, track live progress, view equity curve and trade log |
| **Sentiment** | Live FinBERT classification of financial news headlines per symbol |
| **Trade Log** | Full history of backtest trades with filtering |
| **Benchmark** | Performance comparison against SPY and other benchmarks |
| **Analysis** | Deep strategy analysis — Q-table heatmap, risk metrics, grade scoring |
| **Research Report** | AI-generated explainability report with strategy attribution |

### Themes

9 built-in themes — 5 dark, 4 light — switched from the sidebar dot strip:

| Theme | Type | Character |
| :--- | :--- | :--- |
| Midnight | Dark | Classic dark indigo |
| Ocean | Dark | Deep blue |
| Dusk | Dark | Indigo night / purple |
| Forest | Dark | Dark green |
| Graphite | Dark | Neutral dark grey |
| Ivory | Light | Warm elegant gold |
| Crystal | Light | Clean blue-indigo |
| White | Light | Institutional clean |
| Paper | Light | Blueprint sky blue |

All themes pass **WCAG AA contrast** (4.5:1 for normal text, 3:1 for UI components) across all pages.

---

## Tech Stack

### Frontend
- React + Vite
- Tailwind CSS
- Recharts (AreaChart, BarChart, LineChart)
- React Router
- Axios

### Backend
- FastAPI + Uvicorn
- Pydantic
- Python 3.10+

### Trading Engine
- SARSA reinforcement learning (custom implementation on Lumibot)
- FinBERT (`yiyanghkust/finbert-tone` via Hugging Face)
- QuantStats for tearsheet generation
- Alpaca Markets API for execution
- Yahoo Finance for historical data

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Ndubuisi-Godcares/ReinforceTrader-RL-Based-Stock-Trading-with-Sentiment-Analysis.git
cd rl-sentiment-trader
```

### 2. Backend

```bash
pip install -r backend/requirements.txt
```

Create a `.env` file in the project root:

```env
API_KEY=your_alpaca_key
API_SECRET=your_alpaca_secret
BASE_URL=https://paper-api.alpaca.markets/v2
```

Start the backend:

```bash
uvicorn backend.app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard is available at `http://localhost:5173`.

### 4. Run a Backtest

Either trigger it from the **Backtest** page in the dashboard, or run directly:

```bash
python trading_engine/sarsa-v1.py
```

Results are saved to `logs/` and `reports/tearsheet.html`.

---

## Repository Structure

```
rl-sentiment-trader/
│
├── frontend/                   # React/Vite dashboard
│   ├── src/
│   │   ├── pages/              # Dashboard, Backtest, Sentiment, Trades, Comparison, Analysis, AIReport
│   │   ├── components/         # EquityChart, MetricCard, Sidebar, Topbar, PositionsTable, SentimentWidget
│   │   ├── context/            # ThemeContext (9 themes + CSS variable system)
│   │   └── services/           # Axios API client
│   └── vite.config.js
│
├── backend/
│   └── app/
│       ├── main.py             # FastAPI app — /metrics, /portfolio, /trades, /positions, /sentiment, /backtest
│       └── api/
│
├── trading_engine/
│   ├── sarsa-v1.py             # SARSA agent (Lumibot strategy)
│   ├── finbert_utils.py        # FinBERT sentiment pipeline
│   └── news_classified.py      # Alpaca news fetcher + classifier
│
├── logs/                       # Q-tables, trade CSVs, tearsheet outputs
├── reports/                    # tearsheet.html (QuantStats)
├── data/                       # Benchmark CSVs
└── CLAUDE.md                   # AI coding assistant instructions
```

---

## Strategy Details

### SARSA Agent

The `SARSATrader` class extends Lumibot's `Strategy`. On each daily iteration:

1. Fetches a 3-day news window for the target symbol via Alpaca
2. Classifies headlines with FinBERT → `positive / negative / neutral`
3. Selects an action using ε-greedy policy over the Q-table
4. Executes bracket orders with fixed take-profit (20%) and stop-loss (5%)
5. Calculates reward and updates the Q-table using the SARSA update rule

**Hyperparameters:**

| Parameter | Value |
| :--- | :--- |
| Learning rate (α) | 0.1 |
| Discount factor (γ) | 0.9 |
| Exploration rate (ε) | 0.1 |
| Cash at risk | 50% |
| Take profit | 20% |
| Stop loss | 5% |

### FinBERT

Uses `yiyanghkust/finbert-tone` via the Hugging Face `pipeline` API. CUDA is used automatically when available. Returns a `(probability, sentiment)` tuple for each batch of headlines.

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/metrics` | QuantStats performance metrics (stats CSV as JSON) |
| GET | `/portfolio` | Portfolio time-series and live Alpaca account value |
| GET | `/trades` | Backtest trade log |
| GET | `/positions` | Current open positions (Alpaca paper account) |
| GET | `/sentiment` | Latest FinBERT sentiment for a given symbol |
| POST | `/backtest` | Trigger a new SARSA backtest run |

---

## Roadmap

- [ ] Walk-forward validation across multiple time windows
- [ ] Technical indicator states (RSI, MACD) alongside sentiment
- [ ] Multi-asset portfolio rebalancing
- [ ] Persistent Q-table with database storage
- [ ] Live (non-paper) trading mode
- [ ] DQN / PPO upgrade from tabular SARSA
- [ ] Cloud deployment (Vercel frontend + Render backend)

---

## References

- [FinBERT: Financial Sentiment Analysis with BERT](https://arxiv.org/abs/2006.08097)
- [Alpaca Markets API](https://alpaca.markets/)
- [QuantStats Portfolio Analytics](https://github.com/ranaroussi/quantstats)
- [Lumibot Trading Framework](https://lumibot.lumiwealth.com/)
