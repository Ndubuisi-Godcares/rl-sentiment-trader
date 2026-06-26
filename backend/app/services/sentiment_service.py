"""
Multi-source sentiment: Alpaca news API + Yahoo Finance RSS.
Articles are deduplicated by headline, recency-weighted, then fed to FinBERT
using both headline and summary for richer signal.
"""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.request import urlopen, Request
from urllib.error import URLError
from xml.etree.ElementTree import fromstring as _xml_parse

from app.services.alpaca_client import api

_estimate_sentiment = None  # lazy-loaded on first call


def _load_finbert():
    global _estimate_sentiment
    if _estimate_sentiment is None:
        from trading_engine.finbert_utils import estimate_sentiment
        _estimate_sentiment = estimate_sentiment


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()


def _parse_dt(dt_str: str) -> Optional[datetime]:
    """Best-effort parse of RFC-2822 / ISO-8601 strings → UTC-aware datetime."""
    if not dt_str:
        return None
    fmts = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S%z",
    ]
    for fmt in fmts:
        try:
            return datetime.strptime(dt_str.strip(), fmt).astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _recency_weight(published_str: str, half_life_hours: float = 12.0) -> float:
    """
    Exponential decay: 1.0 for just-published, ~0.5 at half_life_hours,
    floors at 0.02 for articles older than ~3 days.
    """
    dt = _parse_dt(published_str)
    if dt is None:
        return 0.5
    age_hours = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 3600.0)
    return max(0.02, math.exp(-0.693 * age_hours / half_life_hours))


def _fetch_yahoo_rss(symbol: str, limit: int = 25) -> list[dict]:
    """Yahoo Finance RSS — free, no API key. Gracefully returns [] on failure."""
    url = (
        f"https://feeds.finance.yahoo.com/rss/2.0/headline"
        f"?s={symbol}&region=US&lang=en-US"
    )
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=6) as resp:
            xml_data = resp.read()
        root = _xml_parse(xml_data)
        ns = root.tag.split("}")[0] + "}" if root.tag.startswith("{") else ""
        channel = root.find(f"{ns}channel") or root
        articles = []
        for item in channel.findall(f"{ns}item")[:limit]:
            title   = (item.findtext(f"{ns}title") or "").strip()
            desc    = _strip_html(item.findtext(f"{ns}description") or "")
            pubdate = (item.findtext(f"{ns}pubDate") or "").strip()
            link    = (item.findtext(f"{ns}link") or "").strip()
            if not title:
                continue
            articles.append({
                "headline":  title,
                "summary":   desc[:300],
                "source":    "Yahoo Finance",
                "published": pubdate,
                "url":       link,
                "symbols":   [symbol],
            })
        return articles
    except (URLError, Exception):
        return []


def get_sentiment(symbol: str = "SPY", lookback_days: int = 3) -> dict:
    end   = datetime.utcnow()
    start = end - timedelta(days=lookback_days)

    # ── Source 1: Alpaca (Benzinga + wire services) ──────────────────────────
    alpaca_articles: list[dict] = []
    try:
        news = api.get_news(
            symbol=symbol,
            start=start.strftime("%Y-%m-%d"),
            end=end.strftime("%Y-%m-%d"),
            limit=50,
            sort="desc",
        )
        for ev in news:
            raw = ev.__dict__["_raw"]
            alpaca_articles.append({
                "headline":  raw.get("headline", ""),
                "summary":   (raw.get("summary") or "")[:300],
                "source":    raw.get("source") or "Alpaca",
                "published": raw.get("created_at") or "",
                "url":       raw.get("url") or "",
                "symbols":   raw.get("symbols") or [],
            })
    except Exception:
        pass

    # ── Source 2: Yahoo Finance RSS ──────────────────────────────────────────
    yahoo_articles = _fetch_yahoo_rss(symbol, limit=25)

    # ── Merge + deduplicate by exact headline ────────────────────────────────
    seen: set[str] = set()
    all_articles: list[dict] = []
    for article in alpaca_articles + yahoo_articles:
        hl = article.get("headline", "").strip().lower()
        if hl and hl not in seen:
            seen.add(hl)
            all_articles.append(article)

    if not all_articles:
        return {
            "sentiment": "neutral",
            "probability": 0.0,
            "headline_count": 0,
            "articles": [],
            "sources": {},
        }

    # ── Recency weights ───────────────────────────────────────────────────────
    weights = [_recency_weight(a.get("published", "")) for a in all_articles]

    # ── FinBERT inference ─────────────────────────────────────────────────────
    _load_finbert()
    probability, sentiment = _estimate_sentiment(all_articles, weights=weights)

    sources: dict[str, int] = {}
    for a in all_articles:
        src = a.get("source", "Unknown")
        sources[src] = sources.get(src, 0) + 1

    return {
        "sentiment": sentiment,
        "probability": round(float(probability), 4),
        "headline_count": len(all_articles),
        "articles": all_articles,
        "sources": sources,
    }
