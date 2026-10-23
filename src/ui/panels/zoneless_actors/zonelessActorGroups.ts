import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import type { Actor, ActorLayoutGroup } from "@entities/actor/types";
import type { RootState } from "@store/store";

export type ActorGroup = {
  id: ActorLayoutGroup;
  label: string;
  actors: Actor[];
};

const GROUPS: Array<{ id: ActorLayoutGroup; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "ally", label: "Ally" },
  { id: "neutral", label: "Neutral" },
  { id: "enemy", label: "Enemy" }
];

function sortActors(actors: Actor[]): Actor[] {
  return [...actors].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);

    return nameOrder || left.id.localeCompare(right.id);
  });
}

export function getZonelessActors(
  actors: RootState["encounter"]["present"]["actors"], zoneLocked = true
): Actor[] {
  return sortActors(
    actors.allIds
      .map((actorId) => actors.byId[actorId])
      .filter(
        (actor): actor is Actor =>
          !!actor && (zoneLocked ? actor.currentZoneId === ZONELESS_ACTOR_ZONE_ID : !actor.spatialPosition)
      )
  );
}

export function getGroupedActors(actors: Actor[]): ActorGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    actors: actors.filter((actor) => actor.layoutGroup === group.id)
  })).filter((group) => group.actors.length > 0);
}

