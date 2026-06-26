import sys
import os

# Make trading_engine importable from repo root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import metrics, portfolio, trades, positions, sentiment, backtest, comparison

app = FastAPI(title="SARSA Trader API", version="1.0.0")

_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metrics.router)
app.include_router(portfolio.router)
app.include_router(trades.router)
app.include_router(positions.router)
app.include_router(sentiment.router)
app.include_router(backtest.router)
app.include_router(comparison.router)


@app.get("/")
def root():
    return {"status": "ok", "docs": "/docs"}
