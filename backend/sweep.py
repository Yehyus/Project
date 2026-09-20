"""Sweep-and-reclaim setup detection over intraday candles.

A "sweep" is a candle that pokes through a reference level (typically the
prior session's high or low) by at least a penetration threshold, without
the market accepting trade beyond it. A valid setup requires two further
confirmations:

  1. reclaim -- a later candle closes back on the "inside" of the sweep
     candle's extreme (above its high for a low sweep, below its low for a
     high sweep), showing the level failed to hold.
  2. entry trigger -- a later candle breaks back through the reclaim
     candle's extreme in the direction of the trade, confirming momentum.

If the reclaim never happens, there is no valid setup for that level/session
(the entry trigger is not required -- a reclaim with no trigger yet is still
a valid, actionable setup).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

import pandas as pd

Side = Literal["high", "low"]


@dataclass
class SweepSetup:
    side: Side
    level: float
    sweep_time: pd.Timestamp
    sweep_high: float
    sweep_low: float
    reclaim_time: pd.Timestamp
    reclaim_high: float
    reclaim_low: float
    entry_time: Optional[pd.Timestamp] = None
    entry_price: Optional[float] = None


def find_sweep_reclaim(
    df: pd.DataFrame,
    level: float,
    side: Side,
    penetration_threshold: float,
) -> Optional[SweepSetup]:
    """Scan `df` (intraday candles, one session, sorted by time ascending)
    for a sweep/reclaim/entry sequence against `level`.

    side="low": looks for a candle that opens at or above `level` and wicks at
    least `penetration_threshold` below it (a stop-run under a support level),
    then a later candle that closes back above that sweep candle's high, then
    a later candle that breaks above the reclaim candle's high.

    The open must be on the inside of the level: a candle that opens already
    beyond it (a gap through the level) never crossed it, so it isn't a sweep.

    side="high" mirrors this above `level`.

    Returns None if no candle sweeps the level by at least
    `penetration_threshold`, or if a sweep occurs but is never reclaimed.
    """
    if df.empty or penetration_threshold < 0:
        return None

    is_low_sweep = side == "low"

    if is_low_sweep:
        penetrates = (df["open"] >= level) & (df["low"] <= level - penetration_threshold)
    else:
        penetrates = (df["open"] <= level) & (df["high"] >= level + penetration_threshold)

    sweep_times = df.index[penetrates]
    if len(sweep_times) == 0:
        return None

    sweep_time = sweep_times[0]
    sweep_row = df.loc[sweep_time]
    sweep_high = float(sweep_row["high"])
    sweep_low = float(sweep_row["low"])

    after_sweep = df.loc[df.index > sweep_time]
    if is_low_sweep:
        reclaimed = after_sweep.index[after_sweep["close"] > sweep_high]
    else:
        reclaimed = after_sweep.index[after_sweep["close"] < sweep_low]

    if len(reclaimed) == 0:
        return None

    reclaim_time = reclaimed[0]
    reclaim_row = df.loc[reclaim_time]
    reclaim_high = float(reclaim_row["high"])
    reclaim_low = float(reclaim_row["low"])

    setup = SweepSetup(
        side=side,
        level=level,
        sweep_time=sweep_time,
        sweep_high=sweep_high,
        sweep_low=sweep_low,
        reclaim_time=reclaim_time,
        reclaim_high=reclaim_high,
        reclaim_low=reclaim_low,
    )

    after_reclaim = df.loc[df.index > reclaim_time]
    if is_low_sweep:
        triggered = after_reclaim.index[after_reclaim["high"] > reclaim_high]
    else:
        triggered = after_reclaim.index[after_reclaim["low"] < reclaim_low]

    if len(triggered) > 0:
        setup.entry_time = triggered[0]
        setup.entry_price = reclaim_high if is_low_sweep else reclaim_low

    return setup
