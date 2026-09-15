export interface Candle {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  [indicator: string]: number | string | null;
}

export interface CandlesResponse {
  candles: Candle[];
}

export interface SweepSetup {
  side: "high" | "low";
  level: number;
  sweep_time: string;
  sweep_high: number;
  sweep_low: number;
  reclaim_time: string;
  reclaim_high: number;
  reclaim_low: number;
  entry_time: string | null;
  entry_price: number | null;
}

export interface SweepsResponse {
  setups: SweepSetup[];
}
