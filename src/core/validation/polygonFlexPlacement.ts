import { ZONELESS_ACTOR_ZONE_ID } from "../encounter/types";
import type { EncounterState } from "../encounter/types";
import type { LayoutPoint } from "../layout/types";
import {
  findPolygonFlexZoneFit,
  getNestingActorsInZone,
  isZoneLayoutChange
} from "./polygonFlexZoneAdjustment";
import { didZoneGainEngagementMembership } from "./engagementGrowth";
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

function isEngagementAction(action: ValidationAction): boolean {
  return action.type.startsWith('engagement.');
}

function getLayoutChangeZoneIds(
  action: ValidationAction,
  state: EncounterState,
  nextState: EncounterState
): string[] {
  if (
    action.type !== "zone.updateProperties" &&
    action.type !== "zone.exportProperties"
  ) {
    return [];
  }

  const properties = action.payload.properties;

  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return [];
  }

  const changesLayout =
    typeof properties.layoutStrategy === "string" ||
    typeof properties.layoutOrientation === "string";

  if (!changesLayout) {
    return [];
  }

  const zoneIds = [
    action.payload.zoneId,
    ...(Array.isArray(action.payload.targetZoneIds)
      ? action.payload.targetZoneIds
      : [])
  ].filter((zoneId): zoneId is string => typeof zoneId === "string");

  return zoneIds.filter(
    (zoneId) =>
      state.zones.byId[zoneId]?.layoutStrategy !==
        nextState.zones.byId[zoneId]?.layoutStrategy ||
      state.zones.byId[zoneId]?.layoutOrientation !==
        nextState.zones.byId[zoneId]?.layoutOrientation
  );
}

export function getPolygonFlexAffectedZoneIds(
  action: ValidationAction,
  state: EncounterState,
  nextState: EncounterState
): Set<string> {
  const affectedZoneIds = new Set<string>();

  if (isEngagementAction(action)) {
    for (const stateToInspect of [state, nextState]) {
      stateToInspect.engagements.allIds.forEach((id) => {
        const engagement = stateToInspect.engagements.byId[id];
        if (engagement) affectedZoneIds.add(engagement.parentZoneId);
      });
    }
  }

  if (action.type === "zone.reshape") {
    const zoneId = action.payload.zoneId;

    if (typeof zoneId === "string") {
      affectedZoneIds.add(zoneId);
    }
  }

  for (const zoneId of getLayoutChangeZoneIds(
    action,
    state,
    nextState
  )) {
    affectedZoneIds.add(zoneId);
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

/** Detects membership additions independently of the interaction that caused them. */
function didZoneGainActor(
  state: EncounterState,
  nextState: EncounterState,
  zoneId: string
): boolean {
  return nextState.actors.allIds.some((actorId) => {
    const nextActor = nextState.actors.byId[actorId];

    return (
      nextActor?.currentZoneId === zoneId &&
      state.actors.byId[actorId]?.currentZoneId !== zoneId
    );
  });
}

/**
 * Expands affected polygon FLEX zones when a reshape or footprint change
 * cannot fit. Actor entry and Engagement growth opt in through autoResize.
 */
export function adjustPolygonFlexZonesToFit(
  action: ValidationAction,
  state: EncounterState,
  nextEncounter: EncounterState
): PolygonFlexPlacementAdjustment {
  const affectedZoneIds = getPolygonFlexAffectedZoneIds(
    action,
    state,
    nextEncounter
  );
  const canResizeWithoutActorAddition =
    action.type === "zone.reshape" ||
    isActorFootprintChange(action) ||
    isZoneLayoutChange(action);

  if (!canResizeWithoutActorAddition && !Array.from(affectedZoneIds).some(
    (zoneId) =>
      didZoneGainActor(state, nextEncounter, zoneId) ||
      didZoneGainEngagementMembership(state, nextEncounter, zoneId)
  )) {
    return { nextEncounter, resizedZoneIds: [] };
  }

  let adjustedEncounter = nextEncounter;
  const resizedZoneIds: string[] = [];

  for (const zoneId of affectedZoneIds) {
    const zone = adjustedEncounter.zones.byId[zoneId];

    if (!zone) {
      continue;
    }

    const actorWasAdded = didZoneGainActor(state, adjustedEncounter, zoneId);
    const engagementGrew = didZoneGainEngagementMembership(
      state,
      adjustedEncounter,
      zoneId
    );

    if (!canResizeWithoutActorAddition && !actorWasAdded && !engagementGrew) {
      continue;
    }

    if (
      (actorWasAdded || engagementGrew || isZoneLayoutChange(action)) &&
      !zone.autoResize
    ) {
      continue;
    }

    const actors = getNestingActorsInZone(
      adjustedEncounter,
      zoneId,
      zone.layoutStrategy
    );
    const fit = findPolygonFlexZoneFit(
      action,
      adjustedEncounter,
      zoneId,
      zone.polygon,
      actors
    );

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
