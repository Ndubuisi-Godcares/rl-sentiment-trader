"""
GET  /backtest            — most recent results + current run state
POST /backtest/run        — trigger a new backtest (standard or walk-forward)
GET  /backtest/learning   — live Q-table / learning telemetry
"""
import subprocess
import sys
import os
from datetime import date as _date, datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from app.services import logs_reader

router = APIRouter()

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_BACKTEST_TRIGGER_ENABLED = os.getenv("ENABLE_BACKTEST_TRIGGER", "false").lower() == "true"

_backtest_running = False
_backtest_phase   = None          # "training" | "testing" | symbol name | None
_last_config: dict = {"start_date": "2020-01-01", "end_date": "2024-07-31", "symbol": "SPY"}
_wf_results: dict  = {}           # walk-forward period results
_multi_results: list = []         # per-symbol results for multi-symbol runs


def _run_subprocess(extra_args: list) -> None:
    subprocess.run(
        [sys.executable, "trading_engine/sarsa-v1.py"] + extra_args,
        cwd=_REPO_ROOT,
        check=True,
    )


def _base_args(start: str, end: str, symbol: str, stats_file: str = "logs/sarsa_stats.csv",
               trades_file: str = "logs/sarsa_trades.csv", fresh: bool = False) -> list:
    args = ["--start", start, "--end", end, "--symbol", symbol,
            "--stats-file", stats_file, "--trades-file", trades_file]
    if fresh:
        args.append("--fresh-start")
    return args


def _run_standard(start_date: str, end_date: str, symbol: str):
    global _backtest_running, _backtest_phase, _last_config, _wf_results, _multi_results
    _last_config   = {"start_date": start_date, "end_date": end_date, "symbol": symbol}
    _wf_results    = {}
    _multi_results = []
    _backtest_running = True
    _backtest_phase   = None
    try:
        _run_subprocess(_base_args(start_date, end_date, symbol))
    finally:
        _backtest_running = False
        _backtest_phase   = None


def _wf_split(start_date: str, end_date: str):
    d_start = datetime.strptime(start_date, "%Y-%m-%d")
    d_end   = datetime.strptime(end_date,   "%Y-%m-%d")
    split   = d_start + timedelta(days=int((d_end - d_start).days * 0.6))
    return split.strftime("%Y-%m-%d")


def _run_walk_forward(start_date: str, end_date: str, symbol: str):
    """
    60% train (fresh Q-table) → 40% test (loads trained Q-table).
    Stores both periods' stats in _wf_results for the frontend.
    """
    global _backtest_running, _backtest_phase, _last_config, _wf_results, _multi_results
    _last_config   = {"start_date": start_date, "end_date": end_date, "symbol": symbol, "walk_forward": True}
    _wf_results    = {}
    _multi_results = []
    _backtest_running = True

    train_end = _wf_split(start_date, end_date)
    try:
        _backtest_phase = "training"
        _run_subprocess(_base_args(start_date, train_end, symbol,
                                   stats_file=f"logs/wf_{symbol}_train_stats.csv",
                                   trades_file=f"logs/wf_{symbol}_train_trades.csv",
                                   fresh=True))

        _backtest_phase = "testing"
        _run_subprocess(_base_args(train_end, end_date, symbol,
                                   stats_file=f"logs/wf_{symbol}_test_stats.csv",
                                   trades_file=f"logs/wf_{symbol}_test_trades.csv"))

        _wf_results = {
            "train_period": {"start": start_date, "end": train_end},
            "test_period":  {"start": train_end,  "end": end_date},
            "train_stats":  logs_reader.get_stats(stats_file=f"logs/wf_{symbol}_train_stats.csv"),
            "test_stats":   logs_reader.get_stats(stats_file=f"logs/wf_{symbol}_test_stats.csv"),
        }
    finally:
        _backtest_running = False
        _backtest_phase   = None


def _run_multi_symbol(start_date: str, end_date: str, symbols: list, walk_forward: bool):
    """Run standard or walk-forward for each symbol sequentially."""
    global _backtest_running, _backtest_phase, _last_config, _wf_results, _multi_results
    _last_config   = {"start_date": start_date, "end_date": end_date,
                      "symbol": symbols[0], "symbols": symbols, "walk_forward": walk_forward}
    _wf_results    = {}
    _multi_results = []
    _backtest_running = True

    train_end = _wf_split(start_date, end_date) if walk_forward else None
    results   = []
    try:
        for sym in symbols:
            if walk_forward:
                _backtest_phase = f"training:{sym}"
                _run_subprocess(_base_args(start_date, train_end, sym,
                                           stats_file=f"logs/wf_{sym}_train_stats.csv",
                                           trades_file=f"logs/wf_{sym}_train_trades.csv",
                                           fresh=True))
                _backtest_phase = f"testing:{sym}"
                _run_subprocess(_base_args(train_end, end_date, sym,
                                           stats_file=f"logs/wf_{sym}_test_stats.csv",
                                           trades_file=f"logs/wf_{sym}_test_trades.csv"))
                results.append({
                    "symbol":      sym,
                    "train_stats": logs_reader.get_stats(stats_file=f"logs/wf_{sym}_train_stats.csv"),
                    "test_stats":  logs_reader.get_stats(stats_file=f"logs/wf_{sym}_test_stats.csv"),
                })
            else:
                _backtest_phase = sym
                _run_subprocess(_base_args(start_date, end_date, sym))
                results.append({
                    "symbol": sym,
                    "stats":  logs_reader.get_stats(),
                })

        _multi_results = results
        if walk_forward:
            _wf_results = {
                "train_period": {"start": start_date, "end": train_end},
                "test_period":  {"start": train_end,  "end": end_date},
                "per_symbol":   results,
            }
    finally:
        _backtest_running = False
        _backtest_phase   = None


# ─── Request model ────────────────────────────────────────────────────────────

class BacktestRunRequest(BaseModel):
    start_date:   str                  = "2020-01-01"
    end_date:     Optional[str]        = None
    symbol:       str                  = "SPY"
    symbols:      Optional[List[str]]  = None   # overrides symbol for multi-symbol runs
    walk_forward: bool                 = False


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/backtest")
def get_backtest():
    stats            = logs_reader.get_stats()
    trades           = logs_reader.get_trades()
    portfolio_series = logs_reader.get_portfolio_values()
    last_run         = logs_reader.get_last_run_time()
    available        = last_run is not None

    return {
        "running":          _backtest_running,
        "phase":            _backtest_phase,
        "available":        available,
        "last_run":         last_run,
        "config":           _last_config,
        "stats":            stats,
        "portfolio_series": portfolio_series,
        "trades":           trades,
        "walk_forward":     _wf_results  if _wf_results  else None,
        "multi_results":    _multi_results if _multi_results else None,
        "message": (
            f"Backtest running — phase: {_backtest_phase}…" if _backtest_running
            else "No results yet. POST /backtest/run to start." if not available
            else "Results from most recent backtest."
        ),
    }


@router.get("/backtest/learning")
def get_learning():
    state = logs_reader.get_learning_state()
    return {"available": state is not None, "state": state}


@router.post("/backtest/run")
def trigger_backtest(background_tasks: BackgroundTasks, body: BacktestRunRequest = BacktestRunRequest()):
    global _backtest_running
    if not _BACKTEST_TRIGGER_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Live backtesting is disabled in this deployment. View pre-computed results via GET /backtest.",
        )
    if _backtest_running:
        raise HTTPException(status_code=409, detail="A backtest is already running.")

    end     = body.end_date or _date.today().isoformat()
    symbols = [s.upper() for s in body.symbols] if body.symbols else [body.symbol.upper()]

    if len(symbols) > 1:
        background_tasks.add_task(_run_multi_symbol, body.start_date, end, symbols, body.walk_forward)
    elif body.walk_forward:
        background_tasks.add_task(_run_walk_forward, body.start_date, end, symbols[0])
    else:
        background_tasks.add_task(_run_standard, body.start_date, end, symbols[0])

    mode = "walk-forward" if body.walk_forward else "standard"
    return {
        "status":       "started",
        "start_date":   body.start_date,
        "end_date":     end,
        "symbols":      symbols,
        "walk_forward": body.walk_forward,
        "message":      f"{mode.capitalize()} backtest started ({', '.join(symbols)} · {body.start_date} → {end}).",
    }
