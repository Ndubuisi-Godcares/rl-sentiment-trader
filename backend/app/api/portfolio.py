"""
GET /portfolio

Returns two things:
  - current account snapshot from Alpaca (live paper-trading state)
  - historical portfolio value time series from the most recent backtest
"""
from fastapi import APIRouter, HTTPException
from app.services.alpaca_client import api
from app.services import logs_reader

router = APIRouter()


@router.get("/portfolio")
def get_portfolio():
    # Live account state
    try:
        account = api.get_account()
        live = {
            "equity": float(account.equity),
            "cash": float(account.cash),
            "portfolio_value": float(account.portfolio_value),
            "buying_power": float(account.buying_power),
            "currency": account.currency,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Alpaca API error: {exc}")

    # Historical backtest series
    history = logs_reader.get_portfolio_values()

    return {
        "live": live,
        "backtest_series": history,
    }
