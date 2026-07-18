import type { DragEvent } from "react";

export const ZONELESS_ACTOR_DRAG_TYPE =
  "application/x-combat-zone-zoneless-actors";
const ZONELESS_ACTOR_TEXT_PREFIX = "combat-zone:zoneless-actors:";

function readActorIdPayload(event: DragEvent<Element>): string {
  const typedPayload = event.dataTransfer.getData(ZONELESS_ACTOR_DRAG_TYPE);

  if (typedPayload) {
    return typedPayload;
  }

  const textPayload = event.dataTransfer.getData("text/plain");

  return textPayload.startsWith(ZONELESS_ACTOR_TEXT_PREFIX)
    ? textPayload.slice(ZONELESS_ACTOR_TEXT_PREFIX.length)
    : "";
}

export function hasZonelessActorDrag(event: DragEvent<Element>) {
  return (
    Array.from(event.dataTransfer.types).includes(ZONELESS_ACTOR_DRAG_TYPE) ||
    Boolean(readActorIdPayload(event))
  );
}

export function readZonelessActorIds(event: DragEvent<Element>): string[] {
  return readActorIdPayload(event)
    .split(",")
    .map((actorId) => actorId.trim())
    .filter(Boolean);
}

export function getZonelessActorTextPayload(actorIds: string[]): string {
  return `${ZONELESS_ACTOR_TEXT_PREFIX}${actorIds.join(",")}`;
}
