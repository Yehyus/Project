"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DashboardGrid, { type DashboardGridHandle } from "@/components/DashboardGrid";
import Toolbar from "@/components/Toolbar";
import { DEFAULT_COLORS, loadChartColors, saveChartColors, clearChartColors, type ChartColors } from "@/lib/colors";
import styles from "./page.module.css";

export default function Home() {
  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(200);
  const [showEmaFast, setShowEmaFast] = useState(false);
  const [showEmaSlow, setShowEmaSlow] = useState(false);
  const [showVwap, setShowVwap] = useState(false);
  const [showPriorDay, setShowPriorDay] = useState(false);
  const [showSweeps, setShowSweeps] = useState(false);
  const [sweepThresholdTicks, setSweepThresholdTicks] = useState(4);
  const [colors, setColors] = useState<ChartColors>(DEFAULT_COLORS);

  const gridRef = useRef<DashboardGridHandle>(null);

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
        onAddPanel={(type) => gridRef.current?.addPanel(type)}
        colors={colors}
        onColorChange={updateColors}
        onEmaColorChange={updateEmaColor}
        onResetColors={resetColors}
        onResetLayout={() => gridRef.current?.resetLayout()}
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
        showSweeps={showSweeps}
        onShowSweepsChange={setShowSweeps}
        sweepThresholdTicks={sweepThresholdTicks}
        onSweepThresholdTicksChange={setSweepThresholdTicks}
      />
      <main className={styles.main}>
        <DashboardGrid
          ref={gridRef}
          emaPeriods={emaPeriods}
          showVwap={showVwap}
          showPriorDay={showPriorDay}
          showSweeps={showSweeps}
          sweepThresholdTicks={sweepThresholdTicks}
          colors={colors}
        />
      </main>
    </div>
  );
}
