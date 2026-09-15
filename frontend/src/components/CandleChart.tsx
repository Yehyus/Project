"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  ColorType,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, SweepSetup } from "@/lib/types";
import { emaColorFor, type ChartColors } from "@/lib/colors";

interface CandleChartProps {
  candles: Candle[];
  emaPeriods: number[];
  showVwap: boolean;
  showPriorDay: boolean;
  sweeps: SweepSetup[];
  colors: ChartColors;
}

interface ExtraSeriesEntry {
  series: ISeriesApi<"Line">;
  kind: "ema" | "vwap" | "pdh" | "pdl";
  period?: number;
  index?: number;
}

// `datetime` is an exchange-local wall-clock string, e.g.
// "2026-07-08 09:30:00-04:00" (always America/New_York, from the backend).
// lightweight-charts formats its time axis and crosshair labels using the
// UTC getters on `new Date(time * 1000)`, not the viewer's system timezone
// -- so a true absolute-instant timestamp would display 09:30 ET as 13:30
// (its UTC hour) on every viewer's chart, regardless of their own clock.
// Building the epoch from the wall-clock digits directly (ignoring the
// offset) instead makes those UTC getters read back the exchange's own
// hours/minutes, so the axis always shows correct NY session time.
function toUnixTime(datetime: string): UTCTimestamp {
  const [datePart, timePart] = datetime.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.slice(0, 8).split(":").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day, hour, minute, second) / 1000) as UTCTimestamp;
}

export default function CandleChart({
  candles,
  emaPeriods,
  showVwap,
  showPriorDay,
  sweeps,
  colors,
}: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const extraSeriesRef = useRef<ExtraSeriesEntry[]>([]);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const colorsRef = useRef(colors);

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colorsRef.current.background },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2B2B43" },
        horzLines: { color: "#2B2B43" },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: colorsRef.current.candleUp,
      downColor: colorsRef.current.candleDown,
      borderVisible: false,
      wickUpColor: colorsRef.current.candleUp,
      wickDownColor: colorsRef.current.candleDown,
    });
    seriesMarkersRef.current = createSeriesMarkers(candleSeriesRef.current, []);

    // The container is resized by its parent (e.g. a draggable/resizable grid
    // panel), not just the window, so a ResizeObserver is required to keep
    // the chart's internal canvas size in sync with its box on every resize.
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      extraSeriesRef.current = [];
      seriesMarkersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries || candles.length === 0) return;

    candleSeries.setData(
      candles.map((c) => ({
        time: toUnixTime(c.datetime),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    extraSeriesRef.current.forEach(({ series }) => chart.removeSeries(series));
    extraSeriesRef.current = [];

    emaPeriods.forEach((period, index) => {
      const key = `ema_${period}`;
      const points = candles
        .filter((c) => typeof c[key] === "number")
        .map((c) => ({ time: toUnixTime(c.datetime), value: c[key] as number }));
      if (points.length === 0) return;

      const series = chart.addSeries(LineSeries, {
        color: emaColorFor(colorsRef.current, period, index),
        lineWidth: 2,
        title: `EMA ${period}`,
      });
      series.setData(points);
      extraSeriesRef.current.push({ series, kind: "ema", period, index });
    });

    if (showVwap) {
      const points = candles
        .filter((c) => typeof c.vwap === "number")
        .map((c) => ({ time: toUnixTime(c.datetime), value: c.vwap as number }));
      if (points.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: colorsRef.current.vwap,
          lineWidth: 2,
          title: "VWAP",
        });
        series.setData(points);
        extraSeriesRef.current.push({ series, kind: "vwap" });
      }
    }

    if (showPriorDay) {
      // Prior-day high/low changes every session, so this is drawn as a
      // stepped line following each candle's own prior_day_high/low field
      // (not a single flat priceLine off the latest bar) -- a flat line
      // would show whichever session's level happens to be last in the
      // fetched range, which can be a still-forming session whose "prior
      // day" is misleadingly different from the level actually used to
      // evaluate an earlier session's sweep/reclaim.
      const pdhPoints = candles
        .filter((c) => typeof c.prior_day_high === "number")
        .map((c) => ({ time: toUnixTime(c.datetime), value: c.prior_day_high as number }));
      const pdlPoints = candles
        .filter((c) => typeof c.prior_day_low === "number")
        .map((c) => ({ time: toUnixTime(c.datetime), value: c.prior_day_low as number }));

      if (pdhPoints.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: "#26C6DA",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineType: LineType.WithSteps,
          title: "PDH",
        });
        series.setData(pdhPoints);
        extraSeriesRef.current.push({ series, kind: "pdh" });
      }

      if (pdlPoints.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: "#EF9A9A",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          lineType: LineType.WithSteps,
          title: "PDL",
        });
        series.setData(pdlPoints);
        extraSeriesRef.current.push({ series, kind: "pdl" });
      }
    }

    chart.timeScale().fitContent();
  }, [candles, emaPeriods, showVwap, showPriorDay]);

  useEffect(() => {
    const markersApi = seriesMarkersRef.current;
    if (!markersApi) return;

    const markers: SeriesMarker<Time>[] = [];
    sweeps.forEach((s) => {
      const isLowSweep = s.side === "low";

      markers.push({
        time: toUnixTime(s.sweep_time),
        position: isLowSweep ? "belowBar" : "aboveBar",
        color: "#FFB300",
        shape: isLowSweep ? "arrowDown" : "arrowUp",
        text: "Sweep",
      });
      markers.push({
        time: toUnixTime(s.reclaim_time),
        position: isLowSweep ? "belowBar" : "aboveBar",
        color: "#42A5F5",
        shape: "circle",
        text: "Reclaim",
      });
      if (s.entry_time) {
        markers.push({
          time: toUnixTime(s.entry_time),
          position: isLowSweep ? "aboveBar" : "belowBar",
          color: "#66BB6A",
          shape: isLowSweep ? "arrowUp" : "arrowDown",
          text: "Entry",
        });
      }
    });

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersApi.setMarkers(markers);
  }, [sweeps]);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;

    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: colors.background } },
    });
    candleSeries.applyOptions({
      upColor: colors.candleUp,
      downColor: colors.candleDown,
      wickUpColor: colors.candleUp,
      wickDownColor: colors.candleDown,
    });

    extraSeriesRef.current.forEach(({ series, kind, period, index }) => {
      if (kind === "vwap") {
        series.applyOptions({ color: colors.vwap });
      } else if (kind === "ema" && period !== undefined && index !== undefined) {
        series.applyOptions({ color: emaColorFor(colors, period, index) });
      }
    });
  }, [colors]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
