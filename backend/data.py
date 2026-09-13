"""Historical OHLCV data for NQ=F (Nasdaq futures) via yfinance.

Fetches daily or intraday bars and normalizes them into a consistent
DataFrame shape: a tz-aware datetime index named "datetime" and lowercase
open/high/low/close/volume columns, regardless of quirks in the raw
yfinance response (e.g. MultiIndex columns, dividend/split columns).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional, Union

import pandas as pd
import yfinance as yf

TICKER = "NQ=F"

# yfinance/Yahoo enforce how far back intraday data can be requested.
INTRADAY_LOOKBACK_DAYS = {"1m": 7, "5m": 60}
VALID_TIMEFRAMES = {"1d", "5m", "1m"}

DateLike = Union[str, date, datetime]


def get_ohlcv(
    timeframe: str = "1d",
    start: Optional[DateLike] = None,
    end: Optional[DateLike] = None,
) -> pd.DataFrame:
    """Fetch NQ=F OHLCV data for the given timeframe and date range.

    timeframe: "1d", "5m", or "1m".
    start/end: optional date bounds (yfinance semantics: end is exclusive).

    Returns a DataFrame indexed by datetime with columns:
    open, high, low, close, volume.
    """
    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe: {timeframe!r}, expected one of {VALID_TIMEFRAMES}")

    ticker = yf.Ticker(TICKER)
    raw = ticker.history(start=start, end=end, interval=timeframe, auto_adjust=False)

    return _clean(raw)


def _clean(raw: pd.DataFrame) -> pd.DataFrame:
    if raw.empty:
        df = pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
        df.index.name = "datetime"
        return df

    df = raw.copy()

    # Some yfinance versions/call shapes return MultiIndex columns
    # (e.g. ("Open", "NQ=F")) even for a single ticker; flatten to the field.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.rename(columns=str.lower)
    df = df[["open", "high", "low", "close", "volume"]]
    df.index.name = "datetime"
    df = df.sort_index()
    return df
