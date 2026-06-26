"""
GET /comparison — strategy vs SPY comparison data for the comparison page.
"""
from fastapi import APIRouter
from app.services import logs_reader

router = APIRouter()


@router.get("/comparison")
def get_comparison():
    sarsa_series = logs_reader.get_portfolio_values()
    spy_series   = logs_reader.get_spy_series()
    stats        = logs_reader.get_stats()
    attribution  = logs_reader.get_attribution()
    symbol       = logs_reader.get_last_symbol()

    available = bool(sarsa_series or stats)
    return {
        "available":        available,
        "symbol":           symbol,
        "sarsa_series":     sarsa_series,
        "benchmark_series": spy_series,
        "stats":            stats,
        "attribution":      attribution,
    }
