"""
GET /analysis/attribution     — avg returns after each of 14 institutional news categories
GET /analysis/lag-correlation — sentiment lag analysis (T+1, T+2, T+5, T+10 trading days)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Query
from app.services import logs_reader

router = APIRouter()

# ─── 14 institutional news categories ────────────────────────────────────────

CATEGORIES: Dict[str, List[str]] = {
    "Earnings":        ["earnings", "eps", "revenue", "profit", "quarterly result",
                        "beats estimate", "misses estimate", "net income", "guidance"],
    "Federal Reserve": ["fed ", "federal reserve", "fomc", "interest rate", "rate hike",
                        "rate cut", "powell", "dovish", "hawkish", "monetary policy", "basis point"],
    "Inflation":       ["inflation", "cpi", "ppi", "consumer price", "producer price",
                        "cost of living", "deflation", "stagflation"],
    "M&A":             ["merger", "acquisition", "takeover", "buyout", "acquires",
                        "agreed to buy", "purchase agreement", "deal worth"],
    "Geopolitical":    ["war", "conflict", "sanctions", "geopolitical", "military",
                        "nato", "invasion", "ukraine", "taiwan strait", "middle east"],
    "CEO Change":      ["ceo", "chief executive", "leadership change", "steps down",
                        "resigned", "new president", "executive change", "appoints ceo"],
    "Analyst Upgrade": ["upgrade", "downgrade", "price target", "analyst", "outperform",
                        "buy rating", "sell rating", "neutral", "initiate coverage", "overweight"],
    "Product Launch":  ["product launch", "launches new", "unveils", "new product",
                        "introduces", "debut", "announced new"],
    "Supply Chain":    ["supply chain", "shortage", "inventory", "logistics", "disruption",
                        "chip shortage", "port congestion", "freight"],
    "Dividend":        ["dividend", "payout ratio", "special dividend", "dividend cut",
                        "dividend increase", "ex-dividend"],
    "Tariffs":         ["tariff", "trade war", "import duty", "customs duty",
                        "trade policy", "trade barrier"],
    "Bankruptcy":      ["bankruptcy", "bankrupt", "default", "chapter 11",
                        "insolvency", "creditors", "restructuring debt"],
    "Lawsuits":        ["lawsuit", "litigation", "sec investigation", "settlement",
                        "class action", "probe", "indictment"],
    "Macroeconomics":  ["gdp", "unemployment rate", "jobs report", "nonfarm payroll",
                        "economic growth", "recession", "pmi", "retail sales"],
}


def classify_headline(headline: str) -> str:
    lower = headline.lower()
    scores: Dict[str, int] = {}
    for cat, keywords in CATEGORIES.items():
        score = sum(1 for kw in keywords if kw in lower)
        if score:
            scores[cat] = score
    return max(scores, key=scores.get) if scores else "Macroeconomics"


# ─── Data fetchers ────────────────────────────────────────────────────────────

def _fetch_news(symbol: str, start: str, end: str) -> List[Dict]:
    try:
        import requests
    except ImportError:
        return []

    api_key    = os.getenv("API_KEY", "")
    api_secret = os.getenv("API_SECRET", "")
    if not api_key or not api_secret:
        return []

    headers = {
        "APCA-API-KEY-ID":     api_key,
        "APCA-API-SECRET-KEY": api_secret,
    }
    url = "https://data.alpaca.markets/v1beta1/news"
    articles: List[Dict] = []
    page_token: Optional[str] = None

    for _ in range(10):  # 500 articles max (10 pages × 50)
        params: Dict = {"symbols": symbol, "start": start, "end": end, "limit": 50, "sort": "asc"}
        if page_token:
            params["page_token"] = page_token
        try:
            resp = requests.get(url, headers=headers, params=params, timeout=20)
            if resp.status_code != 200:
                break
            data  = resp.json()
            items = data.get("news", [])
            if not items:
                break
            for item in items:
                headline = (item.get("headline") or item.get("summary") or "").strip()
                if headline:
                    articles.append({
                        "headline": headline,
                        "date":     item.get("created_at", "")[:10],
                        "source":   item.get("source", ""),
                    })
            page_token = data.get("next_page_token")
            if not page_token:
                break
        except Exception:
            break

    return articles


def _fetch_prices(symbol: str, start: str, end: str) -> Dict[str, float]:
    try:
        import yfinance as yf
    except ImportError:
        return {}
    try:
        end_ext = (datetime.strptime(end, "%Y-%m-%d") + timedelta(days=20)).strftime("%Y-%m-%d")
        hist    = yf.Ticker(symbol).history(start=start, end=end_ext)
        return {dt.strftime("%Y-%m-%d"): float(row["Close"]) for dt, row in hist.iterrows()}
    except Exception:
        return {}


def _find_price(prices: Dict[str, float], date: str, offset: int = 0) -> Optional[float]:
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        for i in range(offset, offset + 14):
            candidate = (dt + timedelta(days=i)).strftime("%Y-%m-%d")
            if candidate in prices:
                return prices[candidate]
    except Exception:
        pass
    return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/analysis/learning-state")
def get_learning_state_endpoint():
    """Expose the Q-table and learning state for the explainability panel."""
    state = logs_reader.get_learning_state()
    return state if state else {}


@router.get("/analysis/attribution")
def get_attribution(
    symbol:     str           = Query("SPY"),
    start_date: str           = Query("2020-01-01"),
    end_date:   Optional[str] = Query(None),
):
    """Compute average returns after each news category to identify what moves prices."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    articles = _fetch_news(symbol, start_date, end_date)
    prices   = _fetch_prices(symbol, start_date, end_date)

    cat_t1: Dict[str, List[float]] = {c: [] for c in CATEGORIES}
    cat_t5: Dict[str, List[float]] = {c: [] for c in CATEGORIES}
    cat_ex: Dict[str, List[Dict]]  = {c: [] for c in CATEGORIES}
    best  = {"headline": "", "date": "", "return_5d": 0.0,  "source": ""}
    worst = {"headline": "", "date": "", "return_5d": 0.0,  "source": ""}

    for art in articles:
        cat  = classify_headline(art["headline"])
        date = art["date"]
        p0   = _find_price(prices, date, 0)
        if not p0:
            continue

        p1 = _find_price(prices, date, 1)
        p5 = _find_price(prices, date, 5)
        r1 = (p1 - p0) / p0 * 100 if p1 else None
        r5 = (p5 - p0) / p0 * 100 if p5 else None

        if r1 is not None:
            cat_t1[cat].append(r1)
        if r5 is not None:
            cat_t5[cat].append(r5)
            if len(cat_ex[cat]) < 3:
                cat_ex[cat].append({
                    "headline":  art["headline"][:120],
                    "date":      date,
                    "source":    art["source"],
                    "return_1d": round(r1, 2) if r1 is not None else None,
                    "return_5d": round(r5, 2),
                })
            if r5 > best["return_5d"]:
                best  = {"headline": art["headline"][:100], "date": date,
                         "return_5d": round(r5, 2), "source": art["source"]}
            if r5 < worst["return_5d"]:
                worst = {"headline": art["headline"][:100], "date": date,
                         "return_5d": round(r5, 2), "source": art["source"]}

    categories = [
        {
            "category":      cat,
            "article_count": len(cat_t1[cat]),
            "avg_return_1d": round(sum(cat_t1[cat]) / len(cat_t1[cat]), 3) if cat_t1[cat] else 0.0,
            "avg_return_5d": round(sum(cat_t5[cat]) / len(cat_t5[cat]), 3) if cat_t5[cat] else 0.0,
            "examples":      cat_ex[cat],
        }
        for cat in CATEGORIES
    ]
    categories.sort(key=lambda x: x["article_count"], reverse=True)

    return {
        "symbol":         symbol,
        "period":         f"{start_date} → {end_date}",
        "total_articles": len(articles),
        "categories":     categories,
        "extreme_events": {
            "largest_positive": best  if best["headline"]  else None,
            "largest_negative": worst if worst["headline"] else None,
        },
    }


@router.get("/analysis/lag-correlation")
def get_lag_correlation(
    symbol:     str           = Query("SPY"),
    start_date: str           = Query("2020-01-01"),
    end_date:   Optional[str] = Query(None),
):
    """Show how long positive vs negative sentiment affects returns (T+1 to T+10 trading days)."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    articles = _fetch_news(symbol, start_date, end_date)
    prices   = _fetch_prices(symbol, start_date, end_date)

    LAGS    = [1, 2, 5, 10]
    lag_pos: Dict[int, List[float]] = {l: [] for l in LAGS}
    lag_neg: Dict[int, List[float]] = {l: [] for l in LAGS}

    POS = {"surge", "beat", "exceed", "strong", "rise", "gain", "rally", "record",
           "growth", "profit", "upgrade", "positive", "bullish", "soar", "boom"}
    NEG = {"fall", "drop", "miss", "weak", "decline", "loss", "cut", "downgrade",
           "warning", "risk", "default", "bankrupt", "bearish", "plunge", "crash", "slump"}

    for art in articles:
        words = set(art["headline"].lower().split())
        pos   = len(words & POS)
        neg   = len(words & NEG)
        if pos == 0 and neg == 0:
            continue
        sent = "positive" if pos >= neg else "negative"
        p0   = _find_price(prices, art["date"], 0)
        if not p0:
            continue
        for lag in LAGS:
            p_lag = _find_price(prices, art["date"], lag)
            if p_lag:
                ret = (p_lag - p0) / p0 * 100
                (lag_pos if sent == "positive" else lag_neg)[lag].append(ret)

    lags_out = []
    for lag in LAGS:
        pl, nl = lag_pos[lag], lag_neg[lag]
        lags_out.append({
            "lag":                 lag,
            "avg_positive_return": round(sum(pl) / len(pl), 3) if pl else 0.0,
            "avg_negative_return": round(sum(nl) / len(nl), 3) if nl else 0.0,
            "positive_n":          len(pl),
            "negative_n":          len(nl),
        })

    peak = max(lags_out, key=lambda x: abs(x["avg_positive_return"] - x["avg_negative_return"]))

    return {
        "symbol":   symbol,
        "period":   f"{start_date} → {end_date}",
        "lags":     lags_out,
        "peak_lag": peak["lag"],
        "insight":  f"Sentiment divergence is strongest at T+{peak['lag']} trading days",
    }
