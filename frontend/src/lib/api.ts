import type { CandlesResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type Timeframe = "1d" | "5m" | "1m";

export interface FetchCandlesParams {
  timeframe?: Timeframe;
  emaPeriods?: number[];
  vwap?: boolean;
  priorDayLevels?: boolean;
}

export async function fetchCandles({
  timeframe = "1d",
  emaPeriods = [],
  vwap = false,
  priorDayLevels = false,
}: FetchCandlesParams): Promise<CandlesResponse> {
  const params = new URLSearchParams({ timeframe });
  if (emaPeriods.length > 0) {
    params.set("ema", emaPeriods.join(","));
  }
  if (vwap) params.set("vwap", "true");
  if (priorDayLevels) params.set("prior_day_levels", "true");

  const res = await fetch(`${API_BASE}/api/candles?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch candles: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
