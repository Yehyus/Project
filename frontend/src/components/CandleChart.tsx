"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

interface CandleChartProps {
  candles: Candle[];
  emaPeriods: number[];
  showVwap: boolean;
  showPriorDay: boolean;
}

const EMA_COLORS = ["#2962FF", "#FF6D00", "#9C27B0", "#00BFA5"];

function toUnixTime(datetime: string): UTCTimestamp {
  return Math.floor(new Date(datetime.replace(" ", "T")).getTime() / 1000) as UTCTimestamp;
}

export default function CandleChart({ candles, emaPeriods, showVwap, showPriorDay }: CandleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const extraSeriesRef = useRef<ISeriesApi<"Line">[]>([]);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2B2B43" },
        horzLines: { color: "#2B2B43" },
      },
      width: containerRef.current.clientWidth,
      height: 600,
      timeScale: { timeVisible: true, secondsVisible: false },
    });

    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      extraSeriesRef.current = [];
      priceLinesRef.current = [];
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

    extraSeriesRef.current.forEach((series) => chart.removeSeries(series));
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
        color: EMA_COLORS[index % EMA_COLORS.length],
        lineWidth: 2,
        title: `EMA ${period}`,
      });
      series.setData(points);
      extraSeriesRef.current.push(series);
    });

    if (showVwap) {
      const points = candles
        .filter((c) => typeof c.vwap === "number")
        .map((c) => ({ time: toUnixTime(c.datetime), value: c.vwap as number }));
      if (points.length > 0) {
        const series = chart.addSeries(LineSeries, {
          color: "#FFD54F",
          lineWidth: 2,
          title: "VWAP",
        });
        series.setData(points);
        extraSeriesRef.current.push(series);
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

  return <div ref={containerRef} style={{ width: "100%", height: 600 }} />;
}
