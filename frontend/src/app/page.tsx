"use client";

import { useEffect, useMemo, useState } from "react";
import CandleChart from "@/components/CandleChart";
import SettingsPanel from "@/components/SettingsPanel";
import { fetchCandles, type Timeframe } from "@/lib/api";
import type { Candle } from "@/lib/types";
import styles from "./page.module.css";

export default function Home() {
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(200);
  const [showVwap, setShowVwap] = useState(true);
  const [showPriorDay, setShowPriorDay] = useState(true);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emaPeriods = useMemo(
    () => [emaFast, emaSlow].filter((p) => Number.isFinite(p) && p > 0),
    [emaFast, emaSlow]
  );

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

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>NQ=F</h1>
        {error && <p className={styles.error}>Failed to load candles: {error}</p>}
        {loading && <p className={styles.status}>Loading...</p>}
        <CandleChart
          candles={candles}
          emaPeriods={emaPeriods}
          showVwap={showVwap}
          showPriorDay={showPriorDay}
        />
      </main>
      <SettingsPanel
        timeframe={timeframe}
        emaFast={emaFast}
        emaSlow={emaSlow}
        showVwap={showVwap}
        showPriorDay={showPriorDay}
        onTimeframeChange={setTimeframe}
        onEmaFastChange={setEmaFast}
        onEmaSlowChange={setEmaSlow}
        onShowVwapChange={setShowVwap}
        onShowPriorDayChange={setShowPriorDay}
      />
    </div>
  );
}
