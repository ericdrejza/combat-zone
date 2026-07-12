import type { DragEvent } from "react";

export const ZONELESS_ACTOR_DRAG_TYPE =
  "application/x-combat-zone-zoneless-actors";

export function hasZonelessActorDrag(event: DragEvent<Element>) {
  return (
    Array.from(event.dataTransfer.types).includes(ZONELESS_ACTOR_DRAG_TYPE) ||
    Boolean(event.dataTransfer.getData(ZONELESS_ACTOR_DRAG_TYPE))
  );
}

export function readZonelessActorIds(event: DragEvent<Element>): string[] {
  return event.dataTransfer
    .getData(ZONELESS_ACTOR_DRAG_TYPE)
    .split(",")
    .map((actorId) => actorId.trim())
    .filter(Boolean);
}
