import type { ActorZoneAssignment } from "@core/encounter/types";

export type ActorType =
  | "creature"
  | "object"
  | "objective"
  | "pointOfInterest";

export type ActorLayoutGroup = "hero" | "enemy" | "neutral";
export type ActorSize = "small" | "medium" | "large" | "xLarge";
export type ActorShape = "circle" | "rectangle";

export type Actor = {
  id: string;
  name: string;
  actorType: ActorType;
  layoutGroup: ActorLayoutGroup;
  size: ActorSize;
  shape: ActorShape;
  image?: string;
  currentZoneId: ActorZoneAssignment;
  statusEffects: string[];
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
