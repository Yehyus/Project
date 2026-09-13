"""Generic, parameterized technical indicators for OHLCV DataFrames.

Each function takes a DataFrame shaped like the output of data.get_ohlcv
(datetime index, lowercase open/high/low/close/volume columns) and returns
a pandas Series or DataFrame aligned to that same index.
"""

from __future__ import annotations

import pandas as pd


def ema(df: pd.DataFrame, period: int, column: str = "close") -> pd.Series:
    """Exponential moving average of `column` over the given period.

    `period` is a plain lookback length (e.g. 20, 200) -- any positive
    integer is accepted, so callers can request as many/few EMAs as needed.
    """
    if period <= 0:
        raise ValueError("period must be positive")
    return df[column].ewm(span=period, adjust=False).mean()


def session_vwap(df: pd.DataFrame) -> pd.Series:
    """Volume-weighted average price that resets once per session.

    The session boundary is the calendar day in the data's own timezone,
    and the VWAP is accumulated over *every* bar in that session -- including
    overnight/Globex bars -- not just regular trading hours. This matches
    how a futures session VWAP is normally read on a chart: it does not
    reset at the 9:30am RTH open, only at the start of each new session.
    """
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    price_volume = typical_price * df["volume"]

    session_key = df.index.normalize()  # midnight of each day, in-place tz preserved

    cum_pv = price_volume.groupby(session_key).cumsum()
    cum_volume = df["volume"].groupby(session_key).cumsum()

    return cum_pv / cum_volume


def prior_day_high_low(df: pd.DataFrame) -> pd.DataFrame:
    """Prior trading day's high and low, broadcast onto every bar of the
    following day(s).

    Returns a DataFrame with columns prior_day_high / prior_day_low, aligned
    to df's index. The first session in the data has no prior day, so those
    rows are NaN.
    """
    daily = df.resample("D").agg(high=("high", "max"), low=("low", "min")).dropna(how="all")
    prior = daily.shift(1).rename(columns={"high": "prior_day_high", "low": "prior_day_low"})

    session_key = df.index.normalize()
    aligned = prior.reindex(session_key)
    aligned.index = df.index
    return aligned
