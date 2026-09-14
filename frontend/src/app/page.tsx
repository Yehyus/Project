"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardGrid from "@/components/DashboardGrid";
import Toolbar from "@/components/Toolbar";
import { fetchCandles, type Timeframe } from "@/lib/api";
import { DEFAULT_COLORS, loadChartColors, saveChartColors, clearChartColors, type ChartColors } from "@/lib/colors";
import type { Candle } from "@/lib/types";
import styles from "./page.module.css";

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(200);
  const [showEmaFast, setShowEmaFast] = useState(true);
  const [showEmaSlow, setShowEmaSlow] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showPriorDay, setShowPriorDay] = useState(true);
  const [colors, setColors] = useState<ChartColors>(DEFAULT_COLORS);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emaPeriods = useMemo(() => {
    const periods: number[] = [];
    if (showEmaFast && Number.isFinite(emaFast) && emaFast > 0) periods.push(emaFast);
    if (showEmaSlow && Number.isFinite(emaSlow) && emaSlow > 0) periods.push(emaSlow);
    return periods;
  }, [emaFast, emaSlow, showEmaFast, showEmaSlow]);

  useEffect(() => {
    // localStorage is only available client-side, so defaults are rendered
    // first and swapped for the saved colors once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setColors(loadChartColors());
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Standard fetch-in-effect pattern (react.dev/reference/react/useEffect#fetching-data-with-effects):
    // synchronous loading/error resets before kicking off the request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetchCandles({ timeframe, emaPeriods, vwap: showVwap, priorDayLevels: showPriorDay })
      .then((data) => {
        if (!cancelled) setCandles(data.candles);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeframe, emaPeriods, showVwap, showPriorDay]);

  const updateColors = (patch: Partial<ChartColors>) => {
    setColors((prev) => {
      const next = { ...prev, ...patch };
      saveChartColors(next);
      return next;
    });
  };

  const updateEmaColor = (period: number, color: string) => {
    setColors((prev) => {
      const next = { ...prev, emaColors: { ...prev.emaColors, [period]: color } };
      saveChartColors(next);
      return next;
    });
  };

  const resetColors = () => {
    clearChartColors();
    setColors(DEFAULT_COLORS);
  };

  return (
    <div className={styles.page}>
      <Toolbar
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        colors={colors}
        onColorChange={updateColors}
        onEmaColorChange={updateEmaColor}
        onResetColors={resetColors}
        emaPeriods={emaPeriods}
        showVwap={showVwap}
        onShowVwapChange={setShowVwap}
        showPriorDay={showPriorDay}
        onShowPriorDayChange={setShowPriorDay}
        emaFast={emaFast}
        onEmaFastChange={setEmaFast}
        showEmaFast={showEmaFast}
        onShowEmaFastChange={setShowEmaFast}
        emaSlow={emaSlow}
        onEmaSlowChange={setEmaSlow}
        showEmaSlow={showEmaSlow}
        onShowEmaSlowChange={setShowEmaSlow}
      />
      <main className={styles.main}>
        <h1 className={styles.title}>NQ=F</h1>
        {error && <p className={styles.error}>Failed to load candles: {error}</p>}
        {loading && <p className={styles.status}>Loading...</p>}
        <DashboardGrid
          candles={candles}
          emaPeriods={emaPeriods}
          showVwap={showVwap}
          showPriorDay={showPriorDay}
          colors={colors}
        />
      </main>
    </div>
  );
}
