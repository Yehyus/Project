"use client";

import type { Timeframe } from "@/lib/api";
import styles from "./SettingsPanel.module.css";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1d", label: "1 day" },
  { value: "5m", label: "5 minute" },
  { value: "1m", label: "1 minute" },
];

interface SettingsPanelProps {
  timeframe: Timeframe;
  emaFast: number;
  emaSlow: number;
  showVwap: boolean;
  showPriorDay: boolean;
  onTimeframeChange: (value: Timeframe) => void;
  onEmaFastChange: (value: number) => void;
  onEmaSlowChange: (value: number) => void;
  onShowVwapChange: (value: boolean) => void;
  onShowPriorDayChange: (value: boolean) => void;
}

export default function SettingsPanel({
  timeframe,
  emaFast,
  emaSlow,
  showVwap,
  showPriorDay,
  onTimeframeChange,
  onEmaFastChange,
  onEmaSlowChange,
  onShowVwapChange,
  onShowPriorDayChange,
}: SettingsPanelProps) {
  return (
    <aside className={styles.panel}>
      <h2 className={styles.heading}>Settings</h2>

      <label className={styles.field}>
        <span>Timeframe</span>
        <select
          value={timeframe}
          onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf.value} value={tf.value}>
              {tf.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Fast EMA period</span>
        <input
          type="number"
          min={1}
          value={emaFast}
          onChange={(e) => onEmaFastChange(Number(e.target.value))}
        />
      </label>

      <label className={styles.field}>
        <span>Slow EMA period</span>
        <input
          type="number"
          min={1}
          value={emaSlow}
          onChange={(e) => onEmaSlowChange(Number(e.target.value))}
        />
      </label>

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={showVwap}
          onChange={(e) => onShowVwapChange(e.target.checked)}
        />
        <span>Show VWAP</span>
      </label>

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={showPriorDay}
          onChange={(e) => onShowPriorDayChange(e.target.checked)}
        />
        <span>Show prior day high/low</span>
      </label>
    </aside>
  );
}
