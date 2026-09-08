export const DOCKABLE_PANEL_DEFINITIONS = [
  { id: "initiative", title: "Initiative" },
  { id: "library", title: "Library" },
  { id: "log", title: "Log" },
  { id: "properties", title: "Properties" },
  { id: "status", title: "Status" }
] as const;

export type DockablePanelId =
  (typeof DOCKABLE_PANEL_DEFINITIONS)[number]["id"];

export type DockablePanelVisibility = Record<DockablePanelId, boolean>;

export const DEFAULT_DOCKABLE_PANEL_VISIBILITY: DockablePanelVisibility = {
  initiative: true,
  library: true,
  log: true,
  properties: true,
  status: true
};

export function isDockablePanelId(value: string): value is DockablePanelId {
  return DOCKABLE_PANEL_DEFINITIONS.some((panel) => panel.id === value);
}
