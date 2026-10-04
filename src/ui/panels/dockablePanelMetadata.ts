import type { EncounterPanelId } from "@core/encounter/panelLayout";

export const DOCKABLE_PANEL_DEFINITIONS = [
  { id: "audio", title: "Audio", description: "Encounter audio controls." },
  { id: "initiative", title: "Initiative" },
  { id: "library", title: "Library" },
  { id: "log", title: "Log" },
  { id: "properties", title: "Properties" },
  { id: "status", title: "Status", description: "Actor health, resources, and conditions." }
] as const;

export type DockablePanelId = EncounterPanelId;

export type DockablePanelVisibility = Record<DockablePanelId, boolean>;

export const DEFAULT_DOCKABLE_PANEL_VISIBILITY: DockablePanelVisibility = {
  initiative: true,
  library: true,
  log: true,
  properties: true,
  status: true,
  audio: true
};

export function isDockablePanelId(value: string): value is DockablePanelId {
  return DOCKABLE_PANEL_DEFINITIONS.some((panel) => panel.id === value);
}

export function getDockablePanelDefinition(id: DockablePanelId) {
  return DOCKABLE_PANEL_DEFINITIONS.find((panel) => panel.id === id)!;
}
