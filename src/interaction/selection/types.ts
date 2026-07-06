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

export type SelectionState = {
  selectedIds: string[];
  overlayTargets: SelectionOverlayTarget[];
};
