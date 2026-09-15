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
        ("2024-01-02 09:35", 89.3, 89.5, 89.0, 89.2),  # sweep candle (below level=90 by >=0.5)
        ("2024-01-02 09:40", 89.3, 90.2, 89.1, 90.0),  # reclaim candle (closes > 89.5)
        ("2024-01-02 09:45", 90.0, 90.5, 89.8, 90.3),  # entry trigger (high > 90.2)
    ]
)
setup = find_sweep_reclaim(df, level=90.0, side="low", penetration_threshold=0.5)
check("low sweep detected", setup is not None)
check("sweep_time is candle 2", str(setup.sweep_time) == "2024-01-02 09:35:00")
check("reclaim_time is candle 3", str(setup.reclaim_time) == "2024-01-02 09:40:00")
check("entry_time is candle 4", str(setup.entry_time) == "2024-01-02 09:45:00")
check("entry_price equals reclaim_high", setup.entry_price == 90.2)

# --- high sweep: mirrored ---
df_high = make_df(
    [
        ("2024-01-02 09:30", 108, 109.0, 107.0, 108.0),
        ("2024-01-02 09:35", 110.5, 110.8, 110.3, 110.6),  # sweep above level=110 by >=0.5
        ("2024-01-02 09:40", 110.4, 110.6, 109.5, 109.8),  # reclaim: closes < sweep_low (110.3)
        ("2024-01-02 09:45", 109.9, 109.6, 109.0, 109.3),  # entry: low < reclaim_low (109.5)
    ]
)
setup_high = find_sweep_reclaim(df_high, level=110.0, side="high", penetration_threshold=0.5)
check("high sweep detected", setup_high is not None)
check("high sweep entry triggered", setup_high.entry_time is not None)

# --- sweep with no reclaim -> None ---
df_no_reclaim = make_df(
    [
        ("2024-01-02 09:30", 92, 93.0, 91.0, 92.0),
        ("2024-01-02 09:35", 89.3, 89.5, 89.0, 89.2),  # sweep candle
        ("2024-01-02 09:40", 89.0, 89.4, 88.5, 89.0),  # never closes back above 89.5
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
        ("2024-01-02 09:35", 89.3, 89.5, 89.0, 89.2),  # sweep
        ("2024-01-02 09:40", 89.3, 90.2, 89.1, 90.0),  # reclaim
        ("2024-01-02 09:45", 90.0, 90.1, 89.8, 89.9),  # doesn't break 90.2
    ]
)
setup_no_entry = find_sweep_reclaim(df_no_entry, level=90.0, side="low", penetration_threshold=0.5)
check("reclaim without entry is still a valid setup", setup_no_entry is not None)
check("entry_time is None when no trigger yet", setup_no_entry.entry_time is None)

print("\nAll sweep.py checks passed.")
