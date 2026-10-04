import type { ActorZoneAssignment } from "@core/encounter/types";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";

export type ActorType =
  | "creature"
  | "object"
  | "objective"
  | "pointOfInterest";

/** Visual faction; allies share Hero's section in split Zone layouts. */
export type ActorLayoutGroup = "hero" | "ally" | "enemy" | "neutral";
export type ActorSize = "small" | "medium" | "large" | "xLarge";
export type ActorShape = "circle" | "rectangle";
export type ActorStatus = 0 | 1 | 2 | 3;

export type Actor = {
  hitPoints?: import("./actorResources").HitPoints;
  counters?: import("./actorResources").ActorCounters;
  audioGroupIds?: string[];
  id: string;
  name: string;
  actorType: ActorType;
  layoutGroup: ActorLayoutGroup;
  size: ActorSize;
  shape: ActorShape;
  image?: ImageAssetSource;
  currentZoneId: ActorZoneAssignment;
  statusEffects: string[];
  /** Overall health; absent legacy/session values resolve to healthy (3). */
  status?: ActorStatus;
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
