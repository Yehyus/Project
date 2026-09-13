"""FastAPI app exposing NQ=F candles with optional, parameterized indicators."""

from __future__ import annotations

from datetime import date
from typing import List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query

import data
import indicators

app = FastAPI(title="NQ=F Candles API")


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
    timeframe: str = Query("1d", description="1d, 5m, or 1m"),
    start: Optional[date] = Query(None, description="Start date (inclusive)"),
    end: Optional[date] = Query(None, description="End date (exclusive)"),
    ema: Optional[str] = Query(None, description="Comma-separated EMA periods, e.g. 20,200"),
    vwap: bool = Query(False, description="Include session VWAP"),
    prior_day_levels: bool = Query(False, description="Include prior day high/low"),
):
    if timeframe not in data.VALID_TIMEFRAMES:
        raise HTTPException(status_code=400, detail=f"timeframe must be one of {sorted(data.VALID_TIMEFRAMES)}")

    ema_periods = _parse_ema_periods(ema)

    df = data.get_ohlcv(timeframe=timeframe, start=start, end=end)
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
