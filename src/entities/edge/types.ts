export type EdgeDirectionality = "bilateral" | "unilateral";
export type EdgeMovementRule = "blocked" | "skillCheck" | "difficult";
export type EdgeVisibilityRule = "visible" | "obscured" | "hidden";
export type EdgeShape = "straight" | "rightAngled" | "curved" | "sigmoid";

export type Edge = {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  directionality: EdgeDirectionality;
  movementRules: EdgeMovementRule[];
  visibilityRule: EdgeVisibilityRule;
  shape: EdgeShape;
  interactionTags: string[];
  notes?: string;
};
