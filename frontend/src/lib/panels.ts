export type PanelType = "chart" | "placeholder";

export interface PanelInstance {
  id: string;
  type: PanelType;
  title: string;
}

const STORAGE_KEY = "nq-grid-panels";

export const DEFAULT_PANELS: PanelInstance[] = [
  { id: "chart", type: "chart", title: "Chart" },
  { id: "panel-1", type: "placeholder", title: "Panel 1" },
  { id: "panel-2", type: "placeholder", title: "Panel 2" },
];

function isValidPanels(value: unknown): value is PanelInstance[] {
  return (
    Array.isArray(value) &&
    value.every(
      (p): p is PanelInstance =>
        p !== null &&
        typeof p === "object" &&
        typeof (p as PanelInstance).id === "string" &&
        ((p as PanelInstance).type === "chart" || (p as PanelInstance).type === "placeholder") &&
        typeof (p as PanelInstance).title === "string"
    )
  );
}

export function loadPanels(): PanelInstance[] {
  if (typeof window === "undefined") return DEFAULT_PANELS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PANELS;

    const parsed = JSON.parse(raw);
    return isValidPanels(parsed) ? parsed : DEFAULT_PANELS;
  } catch {
    return DEFAULT_PANELS;
  }
}

export function savePanels(panels: PanelInstance[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
}

export function clearPanels(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
