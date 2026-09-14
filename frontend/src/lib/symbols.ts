export interface SymbolOption {
  value: string;
  label: string;
}

export const SYMBOLS: SymbolOption[] = [
  { value: "NQ=F", label: "NQ=F — Nasdaq 100" },
  { value: "ES=F", label: "ES=F — S&P 500" },
  { value: "YM=F", label: "YM=F — Dow Jones" },
  { value: "RTY=F", label: "RTY=F — Russell 2000" },
  { value: "CL=F", label: "CL=F — Crude Oil" },
  { value: "GC=F", label: "GC=F — Gold" },
];

export const DEFAULT_SYMBOL = SYMBOLS[0].value;
