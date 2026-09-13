"use client";

import styles from "./SettingsPanel.module.css";

interface SettingsPanelProps {
  emaFast: number;
  emaSlow: number;
  showVwap: boolean;
  showPriorDay: boolean;
  onEmaFastChange: (value: number) => void;
  onEmaSlowChange: (value: number) => void;
  onShowVwapChange: (value: boolean) => void;
  onShowPriorDayChange: (value: boolean) => void;
}

export default function SettingsPanel({
  emaFast,
  emaSlow,
  showVwap,
  showPriorDay,
  onEmaFastChange,
  onEmaSlowChange,
  onShowVwapChange,
  onShowPriorDayChange,
}: SettingsPanelProps) {
  return (
    <aside className={styles.panel}>
      <h2 className={styles.heading}>Settings</h2>

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
