export type EdgeDirectionality = "one-way" | "two-way";
export type EdgeMovementRule = "free" | "blocked" | "skillCheck" | "difficult";
export type EdgeVisibilityRule = "clear" | "obscured" | "blocked" | "oneWay";

export type Edge = {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  directionality: EdgeDirectionality;
  movementRule: EdgeMovementRule;
  visibilityRule: EdgeVisibilityRule;
  interactionTags: string[];
  notes?: string;
};
