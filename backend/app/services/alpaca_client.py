"""
Thin wrapper around alpaca-trade-api REST client.
Loaded once at module level; endpoints import `api` directly.
"""
import os
from dotenv import load_dotenv, find_dotenv
from alpaca_trade_api import REST

# find_dotenv() walks up from backend/ to find the repo-root .env
load_dotenv(find_dotenv())

# alpaca-trade-api appends /v2 internally, so strip it from BASE_URL if present
_base_url = os.getenv("BASE_URL", "").rstrip("/")
if _base_url.endswith("/v2"):
    _base_url = _base_url[:-3]

api = REST(
    key_id=os.getenv("API_KEY"),
    secret_key=os.getenv("API_SECRET"),
    base_url=_base_url,
)
