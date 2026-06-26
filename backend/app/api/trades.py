"""
GET /trades

Returns:
  - recent order history from Alpaca paper account
  - full trade log from the most recent lumibot backtest CSV
"""
from fastapi import APIRouter, HTTPException
from app.services.alpaca_client import api
from app.services import logs_reader

router = APIRouter()


@router.get("/trades")
def get_trades():
    # Live order history from Alpaca (last 50 closed orders)
    live_trades = []
    try:
        orders = api.list_orders(status="closed", limit=50, direction="desc")
        live_trades = [
            {
                "id": o.id,
                "symbol": o.symbol,
                "side": o.side,
                "qty": float(o.qty),
                "filled_avg_price": float(o.filled_avg_price) if o.filled_avg_price else None,
                "status": o.status,
                "submitted_at": str(o.submitted_at),
                "filled_at": str(o.filled_at) if o.filled_at else None,
            }
            for o in orders
        ]
    except Exception:
        pass  # paper account unavailable — return empty live section

    # Backtest trade log
    backtest_trades = logs_reader.get_trades()

    return {
        "live": live_trades,
        "backtest": backtest_trades,
    }
