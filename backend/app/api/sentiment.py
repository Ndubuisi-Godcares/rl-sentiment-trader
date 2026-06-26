"""
GET /sentiment

Fetches recent SPY news from Alpaca and classifies it with FinBERT.

Query params:
  symbol       (default: SPY)
  lookback_days (default: 3)

Note: first call will be slow (~10-30s) while FinBERT loads into memory.
Subsequent calls are fast.
"""
from fastapi import APIRouter, Query
from app.services.sentiment_service import get_sentiment

router = APIRouter()


@router.get("/sentiment")
def sentiment_endpoint(
    symbol: str = Query(default="SPY"),
    lookback_days: int = Query(default=3, ge=1, le=60),
):
    return get_sentiment(symbol=symbol, lookback_days=lookback_days)
