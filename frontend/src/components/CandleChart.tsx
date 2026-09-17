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
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Timeframe } from "@/lib/api";
import type { Candle, SweepSetup } from "@/lib/types";
import { emaColorFor, type ChartColors } from "@/lib/colors";

interface CandleChartProps {
  candles: Candle[];
  timeframe: Timeframe;
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

function splitDateTime(datetime: string): { date: string; time: string } {
  const [date, timePart] = datetime.split(" ");
  return { date, time: timePart.slice(0, 8) };
}

const RTH_OPEN = "09:30:00";
const RTH_CLOSE = "16:00:00";

export default function CandleChart({
  candles,
  timeframe,
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

    // Extra series (EMA/VWAP/PDH/PDL) must be torn down before the primary
    // candle series gets new data -- switching timeframe (e.g. 5m to daily)
    // replaces candles with a completely different time granularity, and
    // calling setData() on the candle series while a stale extra series
    // from the old granularity is still attached crashes lightweight-charts
    // internally (an "ensureNotNull" exception) and leaves the chart blank.
    extraSeriesRef.current.forEach(({ series }) => chart.removeSeries(series));
    extraSeriesRef.current = [];

    candleSeries.setData(
      candles.map((c) => ({
        time: toUnixTime(c.datetime),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

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

    if (showPriorDay && timeframe !== "1d" && candles.length > 0) {
      // Meaningless on the daily timeframe -- each daily candle already IS
      // a full day, so there's no intraday regular-hours window to find a
      // prior day's high/low against.
      //
      // Show one dotted line each for the single most recent complete prior
      // trading day's regular-hours (9:30-16:00) high and low, starting at
      // that day's own market open and extending through the latest
      // available candle so it works as a live reference against today's
      // price action (not stopping at yesterday's close).
      //
      // The line is built with one point per candle across that whole span
      // (not just 2 endpoints) -- a 2-point line, with a large time gap
      // between its only two points, throws off lightweight-charts'
      // fitContent() bar-spacing calculation and collapses the visible
      // range to a couple of bars. Matching the candle series' own point
      // density avoids that entirely.
      const today = splitDateTime(candles[candles.length - 1].datetime).date;

      let prevDate: string | null = null;
      for (let i = candles.length - 1; i >= 0; i--) {
        const { date, time } = splitDateTime(candles[i].datetime);
        if (date < today && time >= RTH_OPEN && time <= RTH_CLOSE) {
          prevDate = date;
          break;
        }
      }

      if (prevDate) {
        const rthCandles = candles.filter((c) => {
          const { date, time } = splitDateTime(c.datetime);
          return date === prevDate && time >= RTH_OPEN && time <= RTH_CLOSE;
        });

        const startIndex = candles.findIndex((c) => c.datetime === rthCandles[0]?.datetime);

        if (rthCandles.length > 0 && startIndex !== -1) {
          const dayHigh = Math.max(...rthCandles.map((c) => c.high));
          const dayLow = Math.min(...rthCandles.map((c) => c.low));
          const spanCandles = candles.slice(startIndex);

          const pdhSeries = chart.addSeries(LineSeries, {
            color: "#26C6DA",
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            lastValueVisible: false,
            priceLineVisible: false,
            title: "PDH",
          });
          pdhSeries.setData(spanCandles.map((c) => ({ time: toUnixTime(c.datetime), value: dayHigh })));
          extraSeriesRef.current.push({ series: pdhSeries, kind: "pdh" });

          const pdlSeries = chart.addSeries(LineSeries, {
            color: "#EF9A9A",
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            lastValueVisible: false,
            priceLineVisible: false,
            title: "PDL",
          });
          pdlSeries.setData(spanCandles.map((c) => ({ time: toUnixTime(c.datetime), value: dayLow })));
          extraSeriesRef.current.push({ series: pdlSeries, kind: "pdl" });
        }
      }
    }

    chart.timeScale().fitContent();
  }, [candles, timeframe, emaPeriods, showVwap, showPriorDay]);

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
