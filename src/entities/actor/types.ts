import type { ActorZoneAssignment } from "../../core/encounter/types";

export type ActorType =
  | "creature"
  | "object"
  | "objective"
  | "pointOfInterest";

export type ActorLayoutGroup = "hero" | "enemy" | "neutral";

export type Actor = {
  id: string;
  name: string;
  actorType: ActorType;
  layoutGroup: ActorLayoutGroup;
  image?: string;
  currentZoneId: ActorZoneAssignment;
  initiative?: number;
  statusEffects: string[];
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
