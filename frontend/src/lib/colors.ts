const STORAGE_KEY = "nq-chart-colors";

export const DEFAULT_EMA_PALETTE = ["#2962FF", "#FF6D00", "#9C27B0", "#00BFA5"];

export interface ChartColors {
  background: string;
  candleUp: string;
  candleDown: string;
  vwap: string;
  emaColors: Record<number, string>;
}

export const DEFAULT_COLORS: ChartColors = {
  background: "#0d1017",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  vwap: "#FFD54F",
  emaColors: {},
};

export function emaColorFor(colors: ChartColors, period: number, index: number): string {
  return colors.emaColors[period] ?? DEFAULT_EMA_PALETTE[index % DEFAULT_EMA_PALETTE.length];
}

export function loadChartColors(): ChartColors {
  if (typeof window === "undefined") return DEFAULT_COLORS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLORS;

    const parsed = JSON.parse(raw);
    return {
      background: typeof parsed.background === "string" ? parsed.background : DEFAULT_COLORS.background,
      candleUp: typeof parsed.candleUp === "string" ? parsed.candleUp : DEFAULT_COLORS.candleUp,
      candleDown: typeof parsed.candleDown === "string" ? parsed.candleDown : DEFAULT_COLORS.candleDown,
      vwap: typeof parsed.vwap === "string" ? parsed.vwap : DEFAULT_COLORS.vwap,
      emaColors:
        typeof parsed.emaColors === "object" && parsed.emaColors !== null ? parsed.emaColors : {},
    };
  } catch {
    return DEFAULT_COLORS;
  }
}

export function saveChartColors(colors: ChartColors): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

export function clearChartColors(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
