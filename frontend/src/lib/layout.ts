import type { Layout, LayoutItem } from "react-grid-layout";

const STORAGE_KEY = "nq-grid-layout";

export const DEFAULT_LAYOUT: Layout = [
  { i: "chart", x: 0, y: 0, w: 8, h: 12, minW: 4, minH: 4 },
  { i: "panel-1", x: 8, y: 0, w: 4, h: 6, minW: 2, minH: 2 },
  { i: "panel-2", x: 8, y: 6, w: 4, h: 6, minW: 2, minH: 2 },
];

function isValidLayout(value: unknown): value is Layout {
  return (
    Array.isArray(value) &&
    value.every(
      (item): item is LayoutItem =>
        item &&
        typeof item === "object" &&
        typeof item.i === "string" &&
        typeof item.x === "number" &&
        typeof item.y === "number" &&
        typeof item.w === "number" &&
        typeof item.h === "number"
    )
  );
}

export function loadLayout(): Layout {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;

    const parsed = JSON.parse(raw);
    return isValidLayout(parsed) ? parsed : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: Layout): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function clearLayout(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
