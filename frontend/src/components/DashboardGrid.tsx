"use client";

import { useEffect, useState } from "react";
import { GridLayout, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import CandleChart from "@/components/CandleChart";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { DEFAULT_LAYOUT, loadLayout, saveLayout, clearLayout } from "@/lib/layout";
import type { ChartColors } from "@/lib/colors";
import type { Candle } from "@/lib/types";
import styles from "./DashboardGrid.module.css";

interface DashboardGridProps {
  candles: Candle[];
  emaPeriods: number[];
  showVwap: boolean;
  showPriorDay: boolean;
  colors: ChartColors;
}

export default function DashboardGrid({ candles, emaPeriods, showVwap, showPriorDay, colors }: DashboardGridProps) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);

  useEffect(() => {
    // localStorage is only available client-side, so the default layout is
    // rendered first (matching SSR output) and swapped for the saved one
    // once mounted, avoiding a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(loadLayout());
  }, []);

  // onLayoutChange fires on every internal reconciliation (including on
  // mount and whenever the `layout` prop is resynced), not just on user
  // interaction, so it's only used to keep visual state in sync. Persisting
  // to localStorage happens exclusively on drag/resize completion, so a
  // saved layout can never be clobbered by the grid's own mount-time
  // bookkeeping.
  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout);
  };

  const handleInteractionStop = (newLayout: Layout) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  const resetLayout = () => {
    clearLayout();
    setLayout(DEFAULT_LAYOUT);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.resetButton} onClick={resetLayout}>
          Reset layout
        </button>
      </div>
      <div ref={containerRef} className={styles.gridContainer}>
        {mounted && (
          <GridLayout
            layout={layout}
            width={width}
            gridConfig={{ cols: 12, rowHeight: 40, margin: [12, 12] }}
            dragConfig={{ handle: `.${styles.panelHeader}` }}
            onLayoutChange={handleLayoutChange}
            onDragStop={handleInteractionStop}
            onResizeStop={handleInteractionStop}
          >
            <div key="chart" className={styles.panel}>
              <div className={styles.panelHeader}>Chart</div>
              <div className={styles.panelBody}>
                <CandleChart
                  candles={candles}
                  emaPeriods={emaPeriods}
                  showVwap={showVwap}
                  showPriorDay={showPriorDay}
                  colors={colors}
                />
              </div>
            </div>
            <div key="panel-1" className={styles.panel}>
              <div className={styles.panelHeader}>Panel 1</div>
              <div className={styles.panelBody}>
                <PlaceholderPanel />
              </div>
            </div>
            <div key="panel-2" className={styles.panel}>
              <div className={styles.panelHeader}>Panel 2</div>
              <div className={styles.panelBody}>
                <PlaceholderPanel />
              </div>
            </div>
          </GridLayout>
        )}
      </div>
    </div>
  );
}
