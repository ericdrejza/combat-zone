import { ZONELESS_ACTOR_ZONE_ID } from "../encounter/types";
import type { EncounterState } from "../encounter/types";
import { toNestingActor } from "../layout/actorFootprints";
import { findSmallestPolygonFlexZoneFit } from "../layout/polygonFlexZoneFit";
import type { LayoutPoint } from "../layout/types";
import type { ValidationAction } from "./types";

function getActorIdsFromPayload(action: ValidationAction): string[] {
  const actorIds = Array.isArray(action.payload.actorIds)
    ? action.payload.actorIds.filter(
        (actorId): actorId is string => typeof actorId === "string"
      )
    : [];
  const actorId = action.payload.actorId;

  return Array.from(
    new Set(typeof actorId === "string" ? [...actorIds, actorId] : actorIds)
  );
}

function isActorFootprintChange(action: ValidationAction): boolean {
  return (
    action.type === "actor.paint" || action.type === "actor.updateProperties"
  );
}

function isActorMovementOrCreation(action: ValidationAction): boolean {
  return (
    action.type === "actor.create" ||
    action.type === "actor.move" ||
    action.type === "actor.moveMany"
  );
}

export function getPolygonFlexAffectedZoneIds(
  action: ValidationAction,
  state: EncounterState,
  nextState: EncounterState
): Set<string> {
  const affectedZoneIds = new Set<string>();

  if (action.type === "zone.reshape") {
    const zoneId = action.payload.zoneId;

    if (typeof zoneId === "string") {
      affectedZoneIds.add(zoneId);
    }
  }

  const actorIds = getActorIdsFromPayload(action);
  const checksActorFootprints =
    isActorMovementOrCreation(action) || isActorFootprintChange(action);

  if (!checksActorFootprints) {
    return affectedZoneIds;
  }

  for (const actorId of actorIds) {
    const previousActor = state.actors.byId[actorId];
    const nextActor = nextState.actors.byId[actorId];
    const footprintChanged =
      isActorMovementOrCreation(action) ||
      previousActor?.shape !== nextActor?.shape ||
      previousActor?.size !== nextActor?.size;

    if (isActorMovementOrCreation(action)) {
      if (
        footprintChanged &&
        nextActor &&
        nextActor.currentZoneId !== ZONELESS_ACTOR_ZONE_ID
      ) {
        affectedZoneIds.add(nextActor.currentZoneId);
      }

      continue;
    }

    if (
      footprintChanged &&
      previousActor &&
      previousActor.currentZoneId !== ZONELESS_ACTOR_ZONE_ID
    ) {
      affectedZoneIds.add(previousActor.currentZoneId);
    }
    if (
      footprintChanged &&
      nextActor &&
      nextActor.currentZoneId !== ZONELESS_ACTOR_ZONE_ID
    ) {
      affectedZoneIds.add(nextActor.currentZoneId);
    }
  }

  return affectedZoneIds;
}

function replaceZonePolygon(
  state: EncounterState,
  zoneId: string,
  polygon: LayoutPoint[]
): EncounterState {
  const zone = state.zones.byId[zoneId];

  if (!zone) {
    return state;
  }

  return {
    ...state,
    zones: {
      ...state.zones,
      byId: {
        ...state.zones.byId,
        [zoneId]: { ...zone, polygon }
      }
    }
  };
}

export type PolygonFlexPlacementAdjustment = {
  nextEncounter: EncounterState;
  resizedZoneIds: string[];
};

/**
 * Expands affected polygon FLEX zones only when a polygon reshape or
 * actor footprint change cannot fit. Actor entry and movement remain hard fit
 * checks; they must not trigger an expensive automatic zone resize.
 */
export function adjustPolygonFlexZonesToFit(
  action: ValidationAction,
  state: EncounterState,
  nextEncounter: EncounterState
): PolygonFlexPlacementAdjustment {
  const canResizeZone =
    action.type === "zone.reshape" || isActorFootprintChange(action);

  if (!canResizeZone) {
    return { nextEncounter, resizedZoneIds: [] };
  }

  let adjustedEncounter = nextEncounter;
  const resizedZoneIds: string[] = [];

  for (const zoneId of getPolygonFlexAffectedZoneIds(
    action,
    state,
    nextEncounter
  )) {
    const zone = adjustedEncounter.zones.byId[zoneId];

    if (!zone || zone.layoutStrategy !== "FLEX") {
      continue;
    }

    const actors = adjustedEncounter.actors.allIds.flatMap((actorId) => {
      const actor = adjustedEncounter.actors.byId[actorId];

      return actor && actor.currentZoneId === zoneId ? [toNestingActor(actor)] : [];
    });
    const fit = findSmallestPolygonFlexZoneFit(zone.polygon, actors);

    if (fit?.resized) {
      adjustedEncounter = replaceZonePolygon(
        adjustedEncounter,
        zoneId,
        fit.polygon
      );
      resizedZoneIds.push(zoneId);
    }
  }

  return { nextEncounter: adjustedEncounter, resizedZoneIds };
}

export function polygonsEqual(
  first: LayoutPoint[] | undefined,
  second: LayoutPoint[] | undefined
): boolean {
  return Boolean(
    first &&
      second &&
      first.length === second.length &&
      first.every(
        (point, index) =>
          point.x === second[index]?.x && point.y === second[index]?.y
      )
  );
}
