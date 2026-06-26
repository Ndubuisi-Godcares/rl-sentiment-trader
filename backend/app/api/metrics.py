"""
GET /metrics

Returns key performance metrics from the most recent lumibot backtest.
If no backtest has been run yet, returns an empty state with a hint.
"""
from fastapi import APIRouter
from app.services import logs_reader

router = APIRouter()


@router.get("/metrics")
def get_metrics():
    stats = logs_reader.get_stats()

    if stats is None:
        return {
            "available": False,
            "message": "No backtest results found. Run python trading_engine/sarsa-v1.py first.",
        }

    # lumibot stats dict is { column_name: { metric_name: value } }
    # Flatten to { metric: { strategy: val, benchmark: val } }
    return {
        "available": True,
        "stats": stats,
    }
