import os, time
import pandas as pd

START = "2020-01-01"
END = "2024-07-31"
OUT = "data/spy_benchmark.csv"


def try_yfinance_ticker():
    import yfinance as yf
    print("Trying yfinance Ticker.history()...")
    raw = yf.Ticker("SPY").history(start=START, end=END, auto_adjust=False)
    if not raw.empty:
        return raw["Close"]
    return None


def try_yfinance_download():
    import yfinance as yf
    print("Trying yfinance download()...")
    raw = yf.download("SPY", start=START, end=END, auto_adjust=False, progress=False)
    if not raw.empty:
        return raw["Close"].squeeze()
    return None


def try_stooq():
    import requests
    from io import StringIO
    print("Trying Stooq direct download (no rate limits)...")
    url = "https://stooq.com/q/d/l/?s=spy.us&d1=20200101&d2=20240731&i=d"
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    df = pd.read_csv(StringIO(resp.text), parse_dates=["Date"], index_col="Date")
    if not df.empty and "Close" in df.columns:
        return df["Close"].sort_index()
    return None


sources = [try_yfinance_ticker, try_yfinance_download, try_stooq]

close = None
for source in sources:
    try:
        close = source()
        if close is not None and not close.empty:
            break
    except Exception as e:
        print(f"  Failed: {e}")
    time.sleep(2)

if close is not None and not close.empty:
    os.makedirs("data", exist_ok=True)
    close.pct_change().dropna().to_frame("return").to_csv(OUT)
    print(f"Saved {len(close)} rows to {OUT}")
else:
    print("All sources failed. Check your internet connection or try again later.")
