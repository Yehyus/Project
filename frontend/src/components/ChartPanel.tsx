"use client";

import { useEffect, useState } from "react";
import CandleChart from "@/components/CandleChart";
import { fetchCandles, type Timeframe } from "@/lib/api";
import type { ChartColors } from "@/lib/colors";
import type { Candle } from "@/lib/types";
import styles from "./DashboardGrid.module.css";

interface ChartPanelProps {
  symbol: string;
  timeframe: Timeframe;
  emaPeriods: number[];
  showVwap: boolean;
  showPriorDay: boolean;
  colors: ChartColors;
}

export default function ChartPanel({
  symbol,
  timeframe,
  emaPeriods,
  showVwap,
  showPriorDay,
  colors,
}: ChartPanelProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);

    fetchCandles({ symbol, timeframe, emaPeriods, vwap: showVwap, priorDayLevels: showPriorDay })
      .then((data) => {
        if (!cancelled) setCandles(data.candles);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, emaPeriods, showVwap, showPriorDay]);

  return (
    <>
      {error && <p className={styles.chartError}>Failed to load: {error}</p>}
      <CandleChart
        candles={candles}
        emaPeriods={emaPeriods}
        showVwap={showVwap}
        showPriorDay={showPriorDay}
        colors={colors}
      />
    </>
  );
}
