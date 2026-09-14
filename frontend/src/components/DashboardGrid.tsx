"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { GridLayout, useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import CandleChart from "@/components/CandleChart";
import PlaceholderPanel from "@/components/PlaceholderPanel";
import { DEFAULT_LAYOUT, loadLayout, saveLayout, clearLayout } from "@/lib/layout";
import { DEFAULT_PANELS, loadPanels, savePanels, clearPanels, type PanelInstance, type PanelType } from "@/lib/panels";
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

export interface DashboardGridHandle {
  resetLayout: () => void;
  addPanel: (type: PanelType) => void;
}

const PANEL_TITLES: Record<PanelType, string> = {
  chart: "Chart",
  placeholder: "Empty panel",
};

let panelIdCounter = 0;

function createPanelId(type: PanelType): string {
  panelIdCounter += 1;
  return `${type}-${Date.now()}-${panelIdCounter}`;
}

function bottomOf(layout: Layout): number {
  return layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);
}

const DashboardGrid = forwardRef<DashboardGridHandle, DashboardGridProps>(function DashboardGrid(
  { candles, emaPeriods, showVwap, showPriorDay, colors },
  ref
) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [panels, setPanels] = useState<PanelInstance[]>(DEFAULT_PANELS);

  useEffect(() => {
    // localStorage is only available client-side, so the default layout is
    // rendered first (matching SSR output) and swapped for the saved one
    // once mounted, avoiding a hydration mismatch.
    setLayout(loadLayout());
    setPanels(loadPanels());
  }, []);

  // onLayoutChange fires on every internal reconciliation (including on
  // mount and whenever the `layout` prop is resynced), not just on user
  // interaction, so it's only used to keep visual state in sync. Persisting
  // to localStorage happens exclusively on drag/resize completion (and on
  // explicit add/remove actions below), so a saved layout can never be
  // clobbered by the grid's own mount-time bookkeeping.
  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout);
  };

  const handleInteractionStop = (newLayout: Layout) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  };

  const removePanel = (id: string) => {
    setPanels((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePanels(next);
      return next;
    });
    setLayout((prev) => {
      const next = prev.filter((item) => item.i !== id);
      saveLayout(next);
      return next;
    });
  };

  useImperativeHandle(ref, () => ({
    resetLayout: () => {
      clearLayout();
      clearPanels();
      setLayout(DEFAULT_LAYOUT);
      setPanels(DEFAULT_PANELS);
    },
    addPanel: (type: PanelType) => {
      const id = createPanelId(type);
      const newPanel: PanelInstance = { id, type, title: PANEL_TITLES[type] };

      setPanels((prev) => {
        const next = [...prev, newPanel];
        savePanels(next);
        return next;
      });
      setLayout((prev) => {
        const newItem: LayoutItem = { i: id, x: 0, y: bottomOf(prev), w: 4, h: 6, minW: 2, minH: 2 };
        const next = [...prev, newItem];
        saveLayout(next);
        return next;
      });
    },
  }));

  return (
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
          {panels.map((panel) => (
            <div key={panel.id} className={styles.panel}>
              <div className={styles.panelHeader}>
                <span>{panel.title}</span>
                <button
                  type="button"
                  className={styles.closeButton}
                  aria-label={`Close ${panel.title}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => removePanel(panel.id)}
                >
                  ×
                </button>
              </div>
              <div className={styles.panelBody}>
                {panel.type === "chart" ? (
                  <CandleChart
                    candles={candles}
                    emaPeriods={emaPeriods}
                    showVwap={showVwap}
                    showPriorDay={showPriorDay}
                    colors={colors}
                  />
                ) : (
                  <PlaceholderPanel />
                )}
              </div>
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
});

export default DashboardGrid;
