"""FastAPI app exposing candle data with optional, parameterized indicators."""

from __future__ import annotations

import re
from datetime import date, time, timedelta
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import data
import indicators
import sweep as sweep_module

app = FastAPI(title="Candles API")

# yfinance ticker symbols: letters/digits plus the handful of punctuation
# marks Yahoo actually uses (=F futures, ^ indices, . share classes, - misc).
_SYMBOL_RE = re.compile(r"^[A-Za-z0-9=^.\-]{1,15}$")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _parse_ema_periods(ema: Optional[str]) -> List[int]:
    if not ema:
        return []
    try:
        periods = [int(p.strip()) for p in ema.split(",") if p.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid ema periods: {ema!r}")
    for period in periods:
        if period <= 0:
            raise HTTPException(status_code=400, detail=f"ema periods must be positive, got {period}")
    return periods


@app.get("/api/candles")
def get_candles(
    symbol: str = Query(data.DEFAULT_TICKER, description="Ticker symbol, e.g. NQ=F, ES=F, AAPL"),
    timeframe: str = Query("1d", description="1d, 5m, or 1m"),
    start: Optional[date] = Query(None, description="Start date (inclusive)"),
    end: Optional[date] = Query(None, description="End date (exclusive)"),
    ema: Optional[str] = Query(None, description="Comma-separated EMA periods, e.g. 20,200"),
    vwap: bool = Query(False, description="Include session VWAP"),
    prior_day_levels: bool = Query(False, description="Include prior day high/low"),
):
    if not _SYMBOL_RE.match(symbol):
        raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol!r}")

    if timeframe not in data.VALID_TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {sorted(data.VALID_TIMEFRAMES)}")

    ema_periods = _parse_ema_periods(ema)

    df = data.get_ohlcv(symbol=symbol, timeframe=timeframe, start=start, end=end)
    if df.empty:
        return {"candles": []}

    result = df.copy()

    for period in ema_periods:
        result[f"ema_{period}"] = indicators.ema(df, period)

    if vwap:
        result["vwap"] = indicators.session_vwap(df)

    if prior_day_levels:
        result = result.join(indicators.prior_day_high_low(df))

    result = result.reset_index()
    result["datetime"] = result["datetime"].astype(str)
    # Cast to object first so NaN -> None survives (a float column keeps
    # None as NaN otherwise), which json.dumps requires for valid output.
    result = result.astype(object).where(pd.notnull(result), None)

    return {"candles": result.to_dict(orient="records")}


def _serialize_setup(setup: sweep_module.SweepSetup) -> dict:
    return {
        "side": setup.side,
        "level": setup.level,
        "sweep_time": str(setup.sweep_time),
        "sweep_high": setup.sweep_high,
        "sweep_low": setup.sweep_low,
        "reclaim_time": str(setup.reclaim_time),
        "reclaim_high": setup.reclaim_high,
        "reclaim_low": setup.reclaim_low,
        "entry_time": str(setup.entry_time) if setup.entry_time is not None else None,
        "entry_price": setup.entry_price,
    }


# Sweep/reclaim/entry are only looked for during this window of each
# session (exchange local time); the prior-day level itself is still
# computed from the full session, overnight included.
SCAN_WINDOW_START = time(9, 30)
SCAN_WINDOW_END = time(12, 0)


@app.get("/api/sweeps")
def get_sweeps(
    symbol: str = Query(data.DEFAULT_TICKER, description="Ticker symbol, e.g. NQ=F, ES=F, AAPL"),
    start: Optional[date] = Query(None, description="Start date (inclusive)"),
    end: Optional[date] = Query(None, description="End date (exclusive)"),
    threshold_ticks: float = Query(4, gt=0, description="Sweep penetration threshold, in ticks"),
):
    """Detect prior-day-high/low sweep/reclaim/entry setups on 5-minute candles.

    Each session's prior-day high and low (computed from the full prior
    trading session, including its overnight leg) is checked independently
    as a sweep level, but the sweep/reclaim/entry scan itself is restricted
    to the 9:30-12:00 window of the current session.
    """
    if not _SYMBOL_RE.match(symbol):
        raise HTTPException(status_code=400, detail=f"Invalid symbol: {symbol!r}")

    tick_size = data.tick_size_for(symbol)
    threshold = threshold_ticks * tick_size

    # Fetch extra days before `start` so the first requested session still
    # has a real prior-day high/low to sweep, rather than NaN.
    fetch_start = start - timedelta(days=5) if start else None
    df = data.get_ohlcv(symbol=symbol, timeframe="5m", start=fetch_start, end=end)
    if df.empty:
        return {"setups": []}

    levels = indicators.prior_day_high_low(df)
    session_key = indicators.session_date(df.index)

    setups = []
    for day, day_df in df.groupby(session_key):
        if start is not None and day.date() < start:
            continue

        day_levels = levels.loc[day_df.index]
        prior_high = day_levels["prior_day_high"].iloc[0]
        prior_low = day_levels["prior_day_low"].iloc[0]

        bar_times = day_df.index.time
        scan_df = day_df.loc[(bar_times >= SCAN_WINDOW_START) & (bar_times < SCAN_WINDOW_END)]
        if scan_df.empty:
            continue

        if pd.notna(prior_high):
            setup = sweep_module.find_sweep_reclaim(
                scan_df, level=float(prior_high), side="high", penetration_threshold=threshold
            )
            if setup:
                setups.append(_serialize_setup(setup))

        if pd.notna(prior_low):
            setup = sweep_module.find_sweep_reclaim(
                scan_df, level=float(prior_low), side="low", penetration_threshold=threshold
            )
            if setup:
                setups.append(_serialize_setup(setup))

    setups.sort(key=lambda s: s["sweep_time"])
    return {"setups": setups}
