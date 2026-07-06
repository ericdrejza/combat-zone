import type { ActorZoneAssignment } from "../../core/encounter/types";

export type ActorType =
  | "creature"
  | "npc"
  | "object"
  | "objective"
  | "pointOfInterest";

export type Actor = {
  id: string;
  name: string;
  actorType: ActorType;
  image?: string;
  currentZoneId: ActorZoneAssignment;
  initiative?: number;
  statusEffects: string[];
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
