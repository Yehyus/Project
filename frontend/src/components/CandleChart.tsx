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
  type LineData,
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

// For every trading day D, one segment at the previous trading day's
// regular-hours (9:30-16:00) high and low, running from that previous day's
// open through D's close (or through the latest candle, if D is the current
// day still in progress or hasn't reached its open yet).
//
// Consecutive days' segments overlap in time (D's starts during D-1's
// session) and a line series holds one value per timestamp, so each segment
// gets its own series. Each has a point per candle across its whole span --
// matching the candle series' density also avoids a lightweight-charts
// fitContent() failure that sparse two-point lines cause.
function buildPriorDayLines(candles: Candle[]): { high: LineData<Time>[]; low: LineData<Time>[] }[] {
  const parts = candles.map((c) => splitDateTime(c.datetime));

  const rth = new Map<string, { high: number; low: number; first: number; last: number }>();
  parts.forEach(({ date, time }, i) => {
    if (time < RTH_OPEN || time > RTH_CLOSE) return;
    const c = candles[i];
    const day = rth.get(date);
    if (!day) {
      rth.set(date, { high: c.high, low: c.low, first: i, last: i });
    } else {
      day.high = Math.max(day.high, c.high);
      day.low = Math.min(day.low, c.low);
      day.last = i;
    }
  });

  const dates = [...rth.keys()].sort();
  const lastDate = parts[parts.length - 1].date;
  if (dates.length > 0 && dates[dates.length - 1] < lastDate) dates.push(lastDate);

  const lines: { high: LineData<Time>[]; low: LineData<Time>[] }[] = [];
  for (let k = 1; k < dates.length; k++) {
    const prev = rth.get(dates[k - 1]);
    if (!prev) continue;
    const end = rth.get(dates[k])?.last ?? candles.length - 1;
    const times = candles.slice(prev.first, end + 1).map((c) => toUnixTime(c.datetime));
    lines.push({
      high: times.map((time) => ({ time, value: prev.high })),
      low: times.map((time) => ({ time, value: prev.low })),
    });
  }

  return lines;
}

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

    // Meaningless on the daily timeframe -- each daily candle already IS a
    // full day, so there's no intraday regular-hours window to find a prior
    // day's high/low against.
    if (showPriorDay && timeframe !== "1d" && candles.length > 0) {
      const lines = buildPriorDayLines(candles);

      lines.forEach((line, n) => {
        // Only the most recent day's pair gets a label, so the chart doesn't
        // show a stack of duplicate PDH/PDL tags.
        const isLatest = n === lines.length - 1;
        const specs = [
          { kind: "pdh" as const, color: "#26C6DA", title: "PDH", data: line.high },
          { kind: "pdl" as const, color: "#EF9A9A", title: "PDL", data: line.low },
        ];

        specs.forEach(({ kind, color, title, data }) => {
          const series = chart.addSeries(LineSeries, {
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            lastValueVisible: false,
            priceLineVisible: false,
            title: isLatest ? title : "",
          });
          series.setData(data);
          extraSeriesRef.current.push({ series, kind });
        });
      });
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
