export const ENCOUNTER_PANEL_IDS = [
  "initiative",
  "library",
  "log",
  "properties",
  "status"
] as const;

export type EncounterPanelId = (typeof ENCOUNTER_PANEL_IDS)[number];
export type EncounterDockSide = "left" | "right";

export type EncounterPanelState = {
  collapsed: boolean;
  id: EncounterPanelId;
};

export type EncounterPanelLayout = Record<
  EncounterDockSide,
  EncounterPanelState[]
>;

export const DEFAULT_ENCOUNTER_PANEL_LAYOUT: EncounterPanelLayout = {
  left: [
    { id: "library", collapsed: false },
    { id: "properties", collapsed: false },
    { id: "log", collapsed: false }
  ],
  right: [
    { id: "initiative", collapsed: false },
    { id: "status", collapsed: false }
  ]
};
