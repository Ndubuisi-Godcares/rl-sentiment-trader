# AI Sentiment Stock Market Trader

### Abstract
This project and research implements an automated trading system integrating **Reinforcement Learning (SARSA)** and **financial news sentiment analysis**. The system utilizes a complete Machine Learning pipeline featuring real-time data ingestion, historical backtesting, and live execution via the **Alpaca Trading API**.

The architecture combines `FinBERT` for natural language processing of market news with a state-action-reward-state-action (SARSA) agent to optimize trading decisions (Buy/Sell/Hold) based on sentiment signals and market data.

---

### Technical Specifications

#### Core Components
* **Sentiment Analysis Engine:** Utilizes [FinBERT: Financial Sentiment Analysis with BERT](https://arxiv.org/abs/2006.08097) to classify financial news sentiment, providing state signals to the RL agent.
* **RL Agent:** Implements the **SARSA** algorithm to approximate the Q-value function and iteratively learn optimal trading policies.
* **Execution Layer:** Interfaces with **Alpaca Markets API** for secure, real-time order management.
* **Evaluation Engine:** Leverages **QuantStats** for comprehensive backtesting and risk metric calculation against the S&P 500 benchmark.

#### Key Features
1. **Adaptive Learning:** The SARSA agent refines strategies based on continuous reward feedback.
2. **Real-Time Processing:** Low-latency classification of incoming news streams.
3. **Risk Controls:** Integrated position sizing, stop-loss, and take-profit logic.
4. **Simulation Environment:** Robust backtesting using historical data (2020–2024).

---

### System Architecture
<img width="905" height="530" alt="image" src="https://github.com/user-attachments/assets/d5e8555c-b5d4-4cd3-9679-34e5255c4bf2" />

---

### Performance Metrics

**Backtest Period:** 2020 – 2024
**Benchmark:** S&P 500 (SPY)

| Metric | System Performance | Benchmark (SPY) |
| :--- | :--- | :--- |
| **Cumulative Return** | **80.81%** | 79.08% |
| **CAGR** | **9.35%** | **9.19%** |
| **Sharpe Ratio** | **0.47** | **0.41%** |
| **Max Drawdown** | **-27.06%** | **-33.68%** |

> **Note:** Detailed tear sheets and performance reports are generated via `QuantStats`.

![Cumulative Return vs SPY](https://github.com/user-attachments/assets/3bf10715-bb39-47a7-8daf-a4c90c1a0be4)

---

### Installation & Configuration

#### 1. Clone and Install Dependencies
```bash
git clone https://github.com/Ndubuisi-Godcares/ReinforceTrader-RL-Based-Stock-Trading-with-Sentiment-Analysis.git
cd (filename) #Navigate to the folder
pip install -r requirements.txt
```
---

### Configure API Credentials

Create an [Alpaca](https://alpaca.markets/) account and add your keys to `config.py`:

## API Keys

1. Create an [Alpaca](https://alpaca.markets/) account to obtain API keys.

2. Add your Alpaca API keys to the respective scripts (`news_classified.py` and `SARSA1.py`).

   Make sure to update the API credentials in both scripts:
   - **news_classified.py**: Insert your API key and secret for fetching news.
   - **SARSA1.py**: Insert your API key and secret for executing trades.
```python
ALPACA_API_KEY = 'your-api-key'
ALPACA_SECRET_KEY = 'your-secret-key'
```

---

## Usage

Ensure credentials are correctly mapped in:
```
news_classified.py (News ingestion)
SARSA1.py (Trade execution)
```
---

## Repository Structure

```bash
.
├── news_classified.py       # News sentiment classification with FinBERT
├── SARSA1.py                # Reinforcement Learning SARSA trading logic
├── backtest.py              # Backtest engine for historical simulation
├── config.py                # API credentials and config
├── requirements.txt         # Project dependencies
├── tearsheet.html           # QuantStats report
└── README.md                # Project documentation
```

---

## Roadmap
* Data Sources: Integration of alternative sentiment streams (e.g., Reddit, Twitter API).
* Model Optimization: Migration to Deep Q-Network (DQN) or Proximal Policy Optimization (PPO).
* Asset Management: Support for multi-asset portfolio rebalancing.

---

## References & Acknowledgements

- [FinBERT: Financial Sentiment Analysis with BERT](https://github.com/ProsusAI/finBERT)
- [Alpaca Markets API Documentation](https://alpaca.markets/)
- [QuantStats: Portfolio Analytics](https://github.com/ranaroussi/quantstats)

---
