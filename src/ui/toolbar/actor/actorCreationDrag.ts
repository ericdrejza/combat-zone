import type { ActorLayoutGroup, ActorShape, ActorSize } from "@entities/actor/types";
import type { ImageAssetSource } from "@core/assets/imageAssetSource";

export const ACTOR_CREATION_DRAG_TYPE = "combat-zone/new-actor";

export type NewActorDragData = {
  image?: ImageAssetSource;
  imageMediaType?: string;
  imageName?: string;
  layoutGroup: ActorLayoutGroup;
  name: string;
  shape: ActorShape;
  size: ActorSize;
};
