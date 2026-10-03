export const ENCOUNTER_PANEL_IDS = [
  "initiative",
  "library",
  "log",
  "properties",
  "status",
  "audio"
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

export type EncounterPanelOrder = Record<EncounterDockSide, EncounterPanelId[]>;

export const DEFAULT_ENCOUNTER_PANEL_ORDER: EncounterPanelOrder = {
  left: ["library", "properties", "log"],
  right: ["initiative", "status", "audio"]
};

export const DEFAULT_ENCOUNTER_PANEL_LAYOUT: EncounterPanelLayout = {
  left: DEFAULT_ENCOUNTER_PANEL_ORDER.left.map((id) => ({ id, collapsed: false })),
  right: DEFAULT_ENCOUNTER_PANEL_ORDER.right.map((id) => ({ id, collapsed: false }))
};

export function isEncounterPanelOrder(value: unknown): value is EncounterPanelOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<Record<EncounterDockSide, unknown>>;
  if (!Array.isArray(order.left) || !Array.isArray(order.right)) return false;
  const ids = [...order.left, ...order.right];
  return ids.length === ENCOUNTER_PANEL_IDS.length &&
    new Set(ids).size === ENCOUNTER_PANEL_IDS.length &&
    ids.every((id) => ENCOUNTER_PANEL_IDS.includes(id as EncounterPanelId));
}

export function createPanelLayoutFromOrder(order: EncounterPanelOrder): EncounterPanelLayout {
  return {
    left: order.left.map((id) => ({ id, collapsed: false })),
    right: order.right.map((id) => ({ id, collapsed: false }))
  };
}
