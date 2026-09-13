"use client";

import type { Timeframe } from "@/lib/api";
import { emaColorFor, type ChartColors } from "@/lib/colors";
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
  emaPeriods: number[];
  colors: ChartColors;
  onTimeframeChange: (value: Timeframe) => void;
  onEmaFastChange: (value: number) => void;
  onEmaSlowChange: (value: number) => void;
  onShowVwapChange: (value: boolean) => void;
  onShowPriorDayChange: (value: boolean) => void;
  onColorChange: (patch: Partial<ChartColors>) => void;
  onEmaColorChange: (period: number, color: string) => void;
  onResetColors: () => void;
}

export default function SettingsPanel({
  timeframe,
  emaFast,
  emaSlow,
  showVwap,
  showPriorDay,
  emaPeriods,
  colors,
  onTimeframeChange,
  onEmaFastChange,
  onEmaSlowChange,
  onShowVwapChange,
  onShowPriorDayChange,
  onColorChange,
  onEmaColorChange,
  onResetColors,
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

      <hr className={styles.divider} />

      <h2 className={styles.heading}>Colors</h2>

      <label className={styles.colorField}>
        <span>Chart background</span>
        <input
          type="color"
          value={colors.background}
          onChange={(e) => onColorChange({ background: e.target.value })}
        />
      </label>

      <label className={styles.colorField}>
        <span>Candle up</span>
        <input
          type="color"
          value={colors.candleUp}
          onChange={(e) => onColorChange({ candleUp: e.target.value })}
        />
      </label>

      <label className={styles.colorField}>
        <span>Candle down</span>
        <input
          type="color"
          value={colors.candleDown}
          onChange={(e) => onColorChange({ candleDown: e.target.value })}
        />
      </label>

      {emaPeriods.map((period, index) => (
        <label className={styles.colorField} key={period}>
          <span>EMA {period}</span>
          <input
            type="color"
            value={emaColorFor(colors, period, index)}
            onChange={(e) => onEmaColorChange(period, e.target.value)}
          />
        </label>
      ))}

      <label className={styles.colorField}>
        <span>VWAP</span>
        <input
          type="color"
          value={colors.vwap}
          onChange={(e) => onColorChange({ vwap: e.target.value })}
        />
      </label>

      <button type="button" className={styles.resetButton} onClick={onResetColors}>
        Reset to defaults
      </button>
    </aside>
  );
}
