"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
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
  kind: "ema" | "vwap";
  period?: number;
  index?: number;
}

function toUnixTime(datetime: string): UTCTimestamp {
  return Math.floor(new Date(datetime.replace(" ", "T")).getTime() / 1000) as UTCTimestamp;
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
  const priceLinesRef = useRef<IPriceLine[]>([]);
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
      priceLinesRef.current = [];
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
    priceLinesRef.current.forEach((line) => candleSeries.removePriceLine(line));
    priceLinesRef.current = [];

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
      const latest = [...candles]
        .reverse()
        .find((c) => typeof c.prior_day_high === "number" && typeof c.prior_day_low === "number");

      if (latest) {
        priceLinesRef.current.push(
          candleSeries.createPriceLine({
            price: latest.prior_day_high as number,
            color: "#26C6DA",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "PDH",
          }),
          candleSeries.createPriceLine({
            price: latest.prior_day_low as number,
            color: "#EF9A9A",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: "PDL",
          })
        );
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
