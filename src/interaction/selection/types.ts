export type SelectionModifier = "toggle" | "contextual" | "additiveBox";

export type SelectableEntityType =
  | "zone"
  | "edge"
  | "actor"
  | "engagement"
  | "annotation";

export type SelectionOverlayTarget = {
  id: string;
  entityType: SelectableEntityType;
  label: string;
};

export type EntitySelection = {
  entityType: SelectableEntityType;
  ids: string[];
};

export type SelectionState = {
  selectedEntityType: SelectableEntityType | null;
  selectedIds: string[];
  overlayTargets: SelectionOverlayTarget[];
};
