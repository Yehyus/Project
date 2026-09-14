"use client";

import { useEffect, useRef, useState } from "react";
import type { Timeframe } from "@/lib/api";
import { emaColorFor, type ChartColors } from "@/lib/colors";
import { SYMBOLS } from "@/lib/symbols";
import styles from "./Toolbar.module.css";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "1d", label: "D" },
];

interface ToolbarProps {
  symbol: string;
  onSymbolChange: (value: string) => void;

  timeframe: Timeframe;
  onTimeframeChange: (value: Timeframe) => void;

  colors: ChartColors;
  onColorChange: (patch: Partial<ChartColors>) => void;
  onEmaColorChange: (period: number, color: string) => void;
  onResetColors: () => void;
  onResetLayout: () => void;
  emaPeriods: number[];

  showVwap: boolean;
  onShowVwapChange: (value: boolean) => void;
  showPriorDay: boolean;
  onShowPriorDayChange: (value: boolean) => void;

  emaFast: number;
  onEmaFastChange: (value: number) => void;
  showEmaFast: boolean;
  onShowEmaFastChange: (value: boolean) => void;

  emaSlow: number;
  onEmaSlowChange: (value: number) => void;
  showEmaSlow: boolean;
  onShowEmaSlowChange: (value: boolean) => void;
}

type OpenMenu = "settings" | "tools" | null;

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export default function Toolbar({
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  colors,
  onColorChange,
  onEmaColorChange,
  onResetColors,
  onResetLayout,
  emaPeriods,
  showVwap,
  onShowVwapChange,
  showPriorDay,
  onShowPriorDayChange,
  emaFast,
  onEmaFastChange,
  showEmaFast,
  onShowEmaFastChange,
  emaSlow,
  onEmaSlowChange,
  showEmaSlow,
  onShowEmaSlowChange,
}: ToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <div ref={rootRef} className={styles.toolbar}>
      <select
        className={styles.symbolSelect}
        value={symbol}
        onChange={(e) => onSymbolChange(e.target.value)}
        aria-label="Symbol"
      >
        {SYMBOLS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className={styles.timeframes}>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            type="button"
            className={`${styles.timeframeButton} ${timeframe === tf.value ? styles.timeframeButtonActive : ""}`}
            onClick={() => onTimeframeChange(tf.value)}
          >
            {tf.label}
          </button>
        ))}
      </div>

      <div className={styles.spacer} />

      <div className={styles.menuGroup}>
        <button
          type="button"
          className={`${styles.iconButton} ${openMenu === "tools" ? styles.iconButtonActive : ""}`}
          onClick={() => toggleMenu("tools")}
          aria-label="Tools"
        >
          <ToolsIcon />
          <span>Tools</span>
        </button>
        {openMenu === "tools" && (
          <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
            <h3 className={styles.dropdownHeading}>Indicators</h3>

            <div className={styles.toggleRow}>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={showVwap}
                  onChange={(e) => onShowVwapChange(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
              <span>VWAP</span>
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={showPriorDay}
                  onChange={(e) => onShowPriorDayChange(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
              <span>Prior day high/low</span>
            </div>

            <hr className={styles.divider} />

            <div className={styles.toggleRow}>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={showEmaFast}
                  onChange={(e) => onShowEmaFastChange(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
              <span>Fast EMA</span>
              <input
                type="number"
                min={1}
                value={emaFast}
                onChange={(e) => onEmaFastChange(Number(e.target.value))}
                className={styles.periodInput}
              />
            </div>

            <div className={styles.toggleRow}>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={showEmaSlow}
                  onChange={(e) => onShowEmaSlowChange(e.target.checked)}
                />
                <span className={styles.slider} />
              </label>
              <span>Slow EMA</span>
              <input
                type="number"
                min={1}
                value={emaSlow}
                onChange={(e) => onEmaSlowChange(Number(e.target.value))}
                className={styles.periodInput}
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.menuGroup}>
        <button
          type="button"
          className={`${styles.iconButton} ${openMenu === "settings" ? styles.iconButtonActive : ""}`}
          onClick={() => toggleMenu("settings")}
          aria-label="Settings"
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>
        {openMenu === "settings" && (
          <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
            <h3 className={styles.dropdownHeading}>Colors</h3>

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

            <hr className={styles.divider} />

            <h3 className={styles.dropdownHeading}>Layout</h3>
            <button type="button" className={styles.resetButton} onClick={onResetLayout}>
              Reset layout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
