import type { ActorLayoutGroup, ActorShape, ActorSize } from "@entities/actor/types";

export const ACTOR_CREATION_DRAG_TYPE = "combat-zone/new-actor";

export type NewActorDragData = {
  layoutGroup: ActorLayoutGroup;
  name: string;
  shape: ActorShape;
  size: ActorSize;
};
