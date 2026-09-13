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
