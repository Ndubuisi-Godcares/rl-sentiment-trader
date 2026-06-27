<div align="center">

# QuantSentinel

### AI-Powered Reinforcement Learning Trading Platform

*Combining SARSA reinforcement learning with FinBERT financial sentiment analysis to make autonomous buy/sell/hold decisions — backed by a professional full-stack dashboard.*

<br/>

![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)

![HuggingFace](https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![Alpaca](https://img.shields.io/badge/Alpaca_Markets-FECC02?style=for-the-badge&logo=alpaca&logoColor=black)
![Yahoo Finance](https://img.shields.io/badge/Yahoo_Finance-6001D2?style=for-the-badge&logo=yahoo&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-22B5BF?style=for-the-badge&logo=chartdotjs&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white)

</div>

---

## Overview

QuantSentinel is a production-grade algorithmic trading research platform that combines **SARSA reinforcement learning** with **FinBERT financial NLP** to generate autonomous trading signals. The platform provides a complete research workflow — from backtesting and strategy analysis to live paper-trading monitoring — through a professional React dashboard with 9 customizable visual themes.

<img width="905" height="530" alt="System Architecture" src="https://github.com/user-attachments/assets/d5e8555c-b5d4-4cd3-9679-34e5255c4bf2" />

---

## Backtest Performance

**Period:** 2020 – 2024 &nbsp;|&nbsp; **Benchmark:** S&P 500 (SPY) &nbsp;|&nbsp; **Engine:** SARSA ε-greedy + FinBERT

| Metric | QuantSentinel | SPY Benchmark |
| :--- | :---: | :---: |
| **Cumulative Return** | **80.81%** | 79.08% |
| **CAGR** | **9.35%** | 9.19% |
| **Sharpe Ratio** | **0.47** | 0.41 |
| **Max Drawdown** | **-27.06%** | -33.68% |

> Full tear sheets are generated via QuantStats and saved to `reports/tearsheet.html` after each backtest run.

---

## System Architecture

```
┌─────────────────────────────────┐
│       React / Vite Frontend     │  7 pages · 9 themes · Recharts
└────────────────┬────────────────┘
                 │ HTTP / Axios
┌────────────────▼────────────────┐
│        FastAPI Backend          │  REST API · Pydantic · Uvicorn
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│      SARSA Trading Engine       │  Lumibot strategy · Q-table · ε-greedy
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│   FinBERT Sentiment Analysis    │  HuggingFace · yiyanghkust/finbert-tone
└────────────┬───────────┬────────┘
             │           │
     ┌───────▼───┐  ┌────▼────────────┐
     │  Alpaca   │  │  Yahoo Finance  │
     │ Markets   │  │  (Backtesting)  │
     └───────────┘  └─────────────────┘
```

---

## Features

### Dashboard
- Real-time portfolio value and KPI cards (CAGR, Sharpe Ratio, Max Drawdown)
- Adaptive equity curve chart from backtest time-series
- Live open positions from Alpaca paper account
- FinBERT sentiment signal widget with confidence bar and recent headlines

### Backtest Engine
- Trigger SARSA backtests directly from the UI with configurable date range and symbol
- Live progress tracker with stage-by-stage visualization and elapsed timer
- Multi-symbol portfolio backtesting (up to 5 symbols simultaneously)
- Walk-forward validation panel comparing train vs. test period metrics
- Full trade log and QuantStats performance statistics table

### Sentiment Analysis
- Real-time FinBERT classification of financial news headlines
- Per-symbol sentiment feed with source attribution and confidence scores
- Sentiment distribution charts and trend visualization

### Strategy Analysis
- Q-table heatmap showing learned state-action values
- Action and sentiment distribution bar charts
- Risk-adjusted metric deep-dive (Sharpe, Sortino, Calmar, Win Rate)
- Letter-grade strategy scoring with WCAG-compliant visual indicators

### AI Research Report
- Explainability report with FinBERT attribution analysis
- Strategy decision timeline and lag distribution charts
- Automated performance narrative with key findings

### 9 Visual Themes
All themes are **WCAG AA compliant** (≥ 4.5:1 contrast for normal text).

| Theme | Style | Palette |
| :--- | :--- | :--- |
| Midnight | Dark | Deep slate + indigo |
| Ocean | Dark | Deep blue gradient |
| Dusk | Dark | Indigo / purple night |
| Forest | Dark | Dark green |
| Graphite | Dark | Neutral charcoal |
| Ivory | Light | Warm gold / cream |
| Crystal | Light | Blue-indigo glass |
| White | Light | Institutional clean |
| Paper | Light | Sky blue blueprint |

---

## Getting Started

### Prerequisites

| Tool | Version |
| :--- | :--- |
| Python | 3.10 or higher |
| Node.js | 18 or higher |
| npm | 9 or higher |
| Git | Any recent version |

You will also need a free [Alpaca Markets](https://alpaca.markets/) account with paper trading enabled to obtain API credentials.

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/Ndubuisi-Godcares/rl-sentiment-trader.git
cd rl-sentiment-trader
```

---

### Step 2 — Configure Environment Variables

Create a `.env` file in the project root:

```bash
touch .env
```

Add your Alpaca paper trading credentials:

```env
API_KEY=your_alpaca_api_key_here
API_SECRET=your_alpaca_api_secret_here
BASE_URL=https://paper-api.alpaca.markets/v2
```

> **Note:** Never commit the `.env` file. It is already listed in `.gitignore`.

---

### Step 3 — Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

This installs: `fastapi`, `uvicorn`, `lumibot`, `alpaca-trade-api`, `torch`, `transformers`, `quantstats`, `pandas`, `numpy`, `python-dotenv`, and all other required packages.

---

### Step 4 — Start the Backend Server

```bash
uvicorn backend.app.main:app --reload --port 8000
```

The API will be available with interactive documentation at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

### Step 5 — Install Frontend Dependencies

Open a new terminal in the project root:

```bash
cd frontend
npm install
```

---

### Step 6 — Start the Frontend

```bash
npm run dev
```

The dashboard will open and hot-reload automatically as you make changes.

---

### Step 7 — Run Your First Backtest

You can trigger a backtest in two ways:

**Option A — From the dashboard:**
Navigate to the **Backtest** page, select a symbol and date range, then click **Run Backtest**. Progress updates live every 5 seconds.

**Option B — From the terminal:**
```bash
python trading_engine/sarsa-v1.py
```

Results are saved to `logs/` and `reports/tearsheet.html` automatically.

---

## API Reference

The FastAPI backend exposes the following endpoints:

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/metrics` | QuantStats performance metrics as JSON |
| `GET` | `/portfolio` | Portfolio time-series and live account value |
| `GET` | `/trades` | Backtest trade log |
| `GET` | `/positions` | Current open positions (Alpaca paper account) |
| `GET` | `/sentiment` | Latest FinBERT sentiment for a given symbol |
| `POST` | `/backtest` | Trigger a new SARSA backtest run |

---

## Repository Structure

```
rl-sentiment-trader/
│
├── frontend/                        # React / Vite dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Portfolio overview and KPI cards
│   │   │   ├── Backtest.jsx         # Backtest runner and results
│   │   │   ├── Sentiment.jsx        # FinBERT news sentiment feed
│   │   │   ├── Trades.jsx           # Trade history log
│   │   │   ├── Comparison.jsx       # SPY benchmark comparison
│   │   │   ├── Analysis.jsx         # Deep strategy analysis
│   │   │   └── AIReport.jsx         # AI explainability report
│   │   ├── components/
│   │   │   ├── EquityChart.jsx      # Adaptive Recharts area chart
│   │   │   ├── MetricCard.jsx       # KPI tile with accent border
│   │   │   ├── Sidebar.jsx          # Navigation and theme switcher
│   │   │   ├── Topbar.jsx           # Page header with market status
│   │   │   ├── PositionsTable.jsx   # Open positions grid
│   │   │   ├── SentimentWidget.jsx  # Live sentiment signal card
│   │   │   └── SymbolPicker.jsx     # Symbol selector dropdown
│   │   ├── context/
│   │   │   └── ThemeContext.jsx     # 9-theme CSS variable system
│   │   ├── services/
│   │   │   └── api.js               # Axios API client
│   │   └── index.css                # Global styles and theme overrides
│   └── vite.config.js
│
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI application and route handlers
│       └── api/
│           ├── llm_report.py        # AI report generation endpoint
│           └── attribution.py       # Strategy attribution analysis
│
├── trading_engine/
│   ├── sarsa-v1.py                  # SARSA agent (Lumibot strategy class)
│   ├── finbert_utils.py             # FinBERT sentiment pipeline wrapper
│   └── news_classified.py           # Alpaca news fetcher and classifier
│
├── reports/                         # QuantStats HTML tear sheets
├── logs/                            # Q-tables, trade CSVs, run outputs
├── data/                            # Benchmark comparison CSVs
├── .env                             # API credentials (not committed)
└── CLAUDE.md                        # AI assistant coding instructions
```

---

## Strategy Details

### SARSA Agent

The `SARSATrader` class extends Lumibot's `Strategy` base class. Each daily iteration:

1. Fetches a 3-day rolling news window for the target symbol via Alpaca News API
2. Classifies headlines through FinBERT → `positive`, `negative`, or `neutral`
3. Maps the sentiment to the current state in the Q-table
4. Selects an action using an ε-greedy policy (explore vs. exploit)
5. Executes a bracket order with fixed take-profit and stop-loss levels
6. Calculates the step reward and updates the Q-table via the SARSA update rule:

```
Q(s, a) ← Q(s, a) + α [ r + γ · Q(s', a') - Q(s, a) ]
```

### Hyperparameters

| Parameter | Symbol | Value |
| :--- | :---: | :---: |
| Learning rate | α | 0.1 |
| Discount factor | γ | 0.9 |
| Exploration rate | ε | 0.1 |
| Cash at risk | — | 50% |
| Take-profit threshold | — | 20% |
| Stop-loss threshold | — | 5% |

### State and Action Spaces

```
States  → { positive, negative, neutral }
Actions → { buy, sell, hold }
```

---

## Roadmap

- [ ] Persistent Q-table storage with database backend
- [ ] Walk-forward validation across multiple rolling windows
- [ ] Technical indicator states (RSI, MACD) alongside FinBERT sentiment
- [ ] Multi-asset portfolio rebalancing with position sizing
- [ ] Upgrade from tabular SARSA to Deep Q-Network (DQN)
- [ ] Live (non-paper) trading mode with risk controls
- [ ] Cloud deployment — Vercel (frontend) + Render (backend)
- [ ] Alternative sentiment sources (Reddit, SEC filings, earnings calls)

---

## References

- [FinBERT: Financial Sentiment Analysis with BERT](https://arxiv.org/abs/2006.08097) — Araci, 2019
- [Alpaca Markets API Documentation](https://docs.alpaca.markets/)
- [QuantStats: Portfolio Analytics for Quants](https://github.com/ranaroussi/quantstats)
- [Lumibot Algorithmic Trading Framework](https://lumibot.lumiwealth.com/)
- [Hugging Face — yiyanghkust/finbert-tone](https://huggingface.co/yiyanghkust/finbert-tone)
