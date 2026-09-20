"""Manual sanity checks for sweep.find_sweep_reclaim against synthetic candles.

Run with: venv/Scripts/python.exe test_sweep.py
"""

import pandas as pd

from sweep import find_sweep_reclaim


def make_df(rows: list[tuple[str, float, float, float, float]]) -> pd.DataFrame:
    index = pd.to_datetime([r[0] for r in rows])
    return pd.DataFrame(
        {
            "open": [r[1] for r in rows],
            "high": [r[2] for r in rows],
            "low": [r[3] for r in rows],
            "close": [r[4] for r in rows],
        },
        index=index,
    )


def check(label: str, condition: bool) -> None:
    print(f"{'PASS' if condition else 'FAIL'}: {label}")
    assert condition, label


# --- low sweep: reclaim + entry trigger all present ---
df = make_df(
    [
        ("2024-01-02 09:30", 92, 93.0, 91.0, 92.0),
        ("2024-01-02 09:35", 90.2, 90.4, 89.0, 89.2),  # sweep candle (opens above level=90, wicks >=0.5 below)
        ("2024-01-02 09:40", 89.3, 90.8, 89.1, 90.6),  # reclaim candle (closes > 90.4)
        ("2024-01-02 09:45", 90.6, 91.0, 90.4, 90.9),  # entry trigger (high > 90.8)
    ]
)
setup = find_sweep_reclaim(df, level=90.0, side="low", penetration_threshold=0.5)
check("low sweep detected", setup is not None)
check("sweep_time is candle 2", str(setup.sweep_time) == "2024-01-02 09:35:00")
check("reclaim_time is candle 3", str(setup.reclaim_time) == "2024-01-02 09:40:00")
check("entry_time is candle 4", str(setup.entry_time) == "2024-01-02 09:45:00")
check("entry_price equals reclaim_high", setup.entry_price == 90.8)

# --- high sweep: mirrored ---
df_high = make_df(
    [
        ("2024-01-02 09:30", 108, 109.0, 107.0, 108.0),
        ("2024-01-02 09:35", 109.8, 110.8, 109.7, 110.6),  # opens below level=110, wicks >=0.5 above
        ("2024-01-02 09:40", 110.4, 110.6, 109.2, 109.4),  # reclaim: closes < sweep_low (109.7)
        ("2024-01-02 09:45", 109.4, 109.5, 109.0, 109.1),  # entry: low < reclaim_low (109.2)
    ]
)
setup_high = find_sweep_reclaim(df_high, level=110.0, side="high", penetration_threshold=0.5)
check("high sweep detected", setup_high is not None)
check("high sweep entry triggered", setup_high.entry_time is not None)

# --- sweep with no reclaim -> None ---
df_no_reclaim = make_df(
    [
        ("2024-01-02 09:30", 92, 93.0, 91.0, 92.0),
        ("2024-01-02 09:35", 90.2, 90.4, 89.0, 89.2),  # sweep candle
        ("2024-01-02 09:40", 89.0, 89.4, 88.5, 89.0),  # never closes back above 90.4
    ]
)
no_setup = find_sweep_reclaim(df_no_reclaim, level=90.0, side="low", penetration_threshold=0.5)
check("no reclaim -> None", no_setup is None)

# --- no penetration at all -> None ---
df_no_sweep = make_df(
    [
        ("2024-01-02 09:30", 92, 93.0, 91.0, 92.0),
        ("2024-01-02 09:35", 91.0, 91.5, 90.6, 91.2),  # low=90.6 doesn't reach 90 - 0.5 = 89.5
    ]
)
check("no penetration -> None", find_sweep_reclaim(df_no_sweep, level=90.0, side="low", penetration_threshold=0.5) is None)

# --- reclaim with no entry yet -> still a valid setup, entry fields None ---
df_no_entry = make_df(
    [
        ("2024-01-02 09:30", 92, 93.0, 91.0, 92.0),
        ("2024-01-02 09:35", 90.2, 90.4, 89.0, 89.2),  # sweep
        ("2024-01-02 09:40", 89.3, 90.8, 89.1, 90.6),  # reclaim
        ("2024-01-02 09:45", 90.6, 90.7, 90.3, 90.4),  # doesn't break 90.8
    ]
)
setup_no_entry = find_sweep_reclaim(df_no_entry, level=90.0, side="low", penetration_threshold=0.5)
check("reclaim without entry is still a valid setup", setup_no_entry is not None)
check("entry_time is None when no trigger yet", setup_no_entry.entry_time is None)

# --- candle entirely beyond the level (never touched it) is not a sweep ---
df_beyond = make_df(
    [
        ("2024-01-02 09:30", 89.5, 89.8, 89.0, 89.6),  # high 89.8 < level=90: never reached it
        ("2024-01-02 09:35", 89.6, 89.9, 89.4, 89.8),
        ("2024-01-02 09:40", 89.8, 91.0, 89.7, 90.9),
    ]
)
check("candle entirely beyond level -> None", find_sweep_reclaim(df_beyond, level=90.0, side="low", penetration_threshold=0.5) is None)

# --- gap-open candle that still wicks through the level counts ---
df_gap_wick = make_df(
    [
        ("2024-01-02 09:30", 89.8, 90.3, 89.0, 89.9),  # opens below level=90 but its high reaches through it
        ("2024-01-02 09:35", 89.9, 90.7, 89.8, 90.6),  # closes > 90.3: reclaim
        ("2024-01-02 09:40", 90.6, 91.0, 90.5, 90.9),  # high > 90.7: entry
    ]
)
setup_gap = find_sweep_reclaim(df_gap_wick, level=90.0, side="low", penetration_threshold=0.5)
check("gap-open candle wicking through level is a sweep", setup_gap is not None and str(setup_gap.sweep_time) == "2024-01-02 09:30:00")

print("\nAll sweep.py checks passed.")
