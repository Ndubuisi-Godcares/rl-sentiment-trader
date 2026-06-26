"""
GET /positions

Returns open positions. Tries the live Alpaca paper account first; if no
live positions exist, falls back to the position inferred from the most
recent backtest trades CSV.
"""
from fastapi import APIRouter
from app.services.alpaca_client import api
from app.services import logs_reader

router = APIRouter()


@router.get("/positions")
def get_positions():
    live = []
    try:
        positions = api.list_positions()
        live = [
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "side": p.side,
                "avg_entry_price": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "market_value": float(p.market_value),
                "unrealized_pl": float(p.unrealized_pl),
                "unrealized_plpc": float(p.unrealized_plpc),
                "source": "live",
            }
            for p in positions
        ]
    except Exception:
        pass  # paper account unavailable — fall through to backtest fallback

    if live:
        return live

    # No live positions — show what the strategy held at end of last backtest
    bt_pos = logs_reader.get_last_backtest_position()
    return [bt_pos] if bt_pos else []
