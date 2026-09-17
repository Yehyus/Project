"use client";

import { useEffect, useState } from "react";
import CandleChart from "@/components/CandleChart";
import { fetchCandles, fetchSweeps, type Timeframe } from "@/lib/api";
import type { ChartColors } from "@/lib/colors";
import type { Candle, SweepSetup } from "@/lib/types";
import styles from "./DashboardGrid.module.css";

interface ChartPanelProps {
  symbol: string;
  timeframe: Timeframe;
  emaPeriods: number[];
  showVwap: boolean;
  showPriorDay: boolean;
  showSweeps: boolean;
  sweepThresholdTicks: number;
  colors: ChartColors;
}

export default function ChartPanel({
  symbol,
  timeframe,
  emaPeriods,
  showVwap,
  showPriorDay,
  showSweeps,
  sweepThresholdTicks,
  colors,
}: ChartPanelProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sweeps, setSweeps] = useState<SweepSetup[]>([]);
  const [sweepsError, setSweepsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);

    fetchCandles({ symbol, timeframe, emaPeriods, vwap: showVwap })
      .then((data) => {
        if (!cancelled) setCandles(data.candles);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, emaPeriods, showVwap]);

  // Sweep/reclaim detection runs on 5-min candles server-side, so markers
  // only make sense to overlay when the panel itself is on the 5m timeframe.
  useEffect(() => {
    if (!showSweeps || timeframe !== "5m") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSweeps([]);
      setSweepsError(null);
      return;
    }

    let cancelled = false;
    setSweepsError(null);

    fetchSweeps({ symbol, thresholdTicks: sweepThresholdTicks })
      .then((data) => {
        if (!cancelled) setSweeps(data.setups);
      })
      .catch((err) => {
        if (!cancelled) setSweepsError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, showSweeps, sweepThresholdTicks]);

  return (
    <>
      {error && <p className={styles.chartError}>Failed to load: {error}</p>}
      {sweepsError && <p className={styles.chartError}>Failed to load sweeps: {sweepsError}</p>}
      <CandleChart
        candles={candles}
        emaPeriods={emaPeriods}
        showVwap={showVwap}
        showPriorDay={showPriorDay}
        sweeps={sweeps}
        colors={colors}
      />
    </>
  );
}
