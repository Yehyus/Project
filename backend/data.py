"""Historical OHLCV data for a given ticker symbol via yfinance.

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

DEFAULT_TICKER = "NQ=F"

# yfinance/Yahoo enforce how far back intraday data can be requested.
INTRADAY_LOOKBACK_DAYS = {"1m": 7, "5m": 60}
VALID_TIMEFRAMES = {"1d", "5m", "1m"}

# Minimum price increment per futures contract, used to convert a
# tick-count threshold (e.g. "4 ticks") into a price offset. Unlisted
# symbols fall back to DEFAULT_TICK_SIZE.
TICK_SIZES = {
    "NQ=F": 0.25,
    "ES=F": 0.25,
    "YM=F": 1.0,
    "RTY=F": 0.1,
    "CL=F": 0.01,
    "GC=F": 0.1,
}
DEFAULT_TICK_SIZE = 0.25


def tick_size_for(symbol: str) -> float:
    return TICK_SIZES.get(symbol, DEFAULT_TICK_SIZE)

DateLike = Union[str, date, datetime]


def get_ohlcv(
    symbol: str = DEFAULT_TICKER,
    timeframe: str = "1d",
    start: Optional[DateLike] = None,
    end: Optional[DateLike] = None,
) -> pd.DataFrame:
    """Fetch OHLCV data for `symbol` and the given timeframe/date range.

    symbol: any ticker yfinance accepts (e.g. "NQ=F", "ES=F", "AAPL").
    timeframe: "1d", "5m", or "1m".
    start/end: optional date bounds (yfinance semantics: end is exclusive).

    Returns a DataFrame indexed by datetime with columns:
    open, high, low, close, volume.
    """
    if timeframe not in VALID_TIMEFRAMES:
        raise ValueError(f"Unsupported timeframe: {timeframe!r}, expected one of {VALID_TIMEFRAMES}")

    ticker = yf.Ticker(symbol)

    lookback_days = INTRADAY_LOOKBACK_DAYS.get(timeframe)
    if start is None and end is None and lookback_days is not None:
        # yfinance's own default lookback (~1 month) exceeds what Yahoo allows
        # for intraday granularity, so it would otherwise come back empty.
        raw = ticker.history(period=f"{lookback_days}d", interval=timeframe, auto_adjust=False)
    else:
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
