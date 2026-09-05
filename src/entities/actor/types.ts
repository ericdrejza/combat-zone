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

export type Actor = {
  id: string;
  name: string;
  actorType: ActorType;
  layoutGroup: ActorLayoutGroup;
  size: ActorSize;
  shape: ActorShape;
  image?: ImageAssetSource;
  currentZoneId: ActorZoneAssignment;
  statusEffects: string[];
  metadata: Record<string, unknown>;
  stats?: Record<string, unknown>;
};
