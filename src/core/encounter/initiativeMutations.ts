import type { EntityId } from "@core/state/entityCollection";
import type { EncounterState, InitiativeTrackerState } from "./types";

export const INITIATIVE_MIN = -10;
export const INITIATIVE_MAX = 99;

function valueFor(state: EncounterState, actorId: EntityId): number | undefined {
  return state.actors.byId[actorId]?.initiative;
}

/** Keeps score groups descending while retaining persisted order within ties. */
export function sortInitiativeActorIds(
  state: EncounterState,
  actorIds: EntityId[]
): EntityId[] {
  return actorIds
    .map((actorId, index) => ({ actorId, index, value: valueFor(state, actorId) }))
    .sort((left, right) => {
      if (left.value === undefined && right.value === undefined) {
        return left.index - right.index;
      }
      if (left.value === undefined) return 1;
      if (right.value === undefined) return -1;
      return right.value - left.value || left.index - right.index;
    })
    .map(({ actorId }) => actorId);
}

function alphabetizeActorIds(state: EncounterState, actorIds: EntityId[]) {
  return [...actorIds].sort((leftId, rightId) => {
    const leftName = state.actors.byId[leftId]?.name ?? leftId;
    const rightName = state.actors.byId[rightId]?.name ?? rightId;
    return leftName.localeCompare(rightName) || leftId.localeCompare(rightId);
  });
}

/** Adds a batch after existing tie members and alphabetizes only that batch. */
export function addActorsToInitiative(
  state: EncounterState,
  actorIds: EntityId[]
): EncounterState {
  const existingIds = new Set(state.initiativeTracker.actorIds);
  const uniqueNewIds = [...new Set(actorIds)].filter(
    (actorId) => state.actors.byId[actorId] && !existingIds.has(actorId)
  );
  if (uniqueNewIds.length === 0) return state;

  const actorIdsWithBatch = [
    ...state.initiativeTracker.actorIds,
    ...alphabetizeActorIds(state, uniqueNewIds)
  ];
  return {
    ...state,
    initiativeTracker: {
      ...state.initiativeTracker,
      actorIds: sortInitiativeActorIds(state, actorIdsWithBatch)
    }
  };
}

export function updateInitiativeValue(
  state: EncounterState,
  actorId: EntityId,
  initiative: number | undefined
): EncounterState {
  const actor = state.actors.byId[actorId];
  if (!actor || actor.initiative === initiative) return state;

  const nextState: EncounterState = {
    ...state,
    actors: {
      ...state.actors,
      byId: { ...state.actors.byId, [actorId]: { ...actor, initiative } }
    }
  };
  const currentIds = state.initiativeTracker.actorIds;
  const actorIds = currentIds.includes(actorId)
    ? sortInitiativeActorIds(nextState, currentIds)
    : currentIds;

  return {
    ...nextState,
    initiativeTracker: { ...state.initiativeTracker, actorIds }
  };
}

/** Applies a drop order and derives the dragged actor's score from its neighbor. */
export function reorderInitiativeActor(
  state: EncounterState,
  actorId: EntityId,
  requestedActorIds: EntityId[]
): EncounterState {
  const currentIds = state.initiativeTracker.actorIds;
  if (
    requestedActorIds.length !== currentIds.length ||
    new Set(requestedActorIds).size !== currentIds.length ||
    requestedActorIds.some((id) => !currentIds.includes(id))
  ) {
    return state;
  }

  const targetIndex = requestedActorIds.indexOf(actorId);
  const actor = state.actors.byId[actorId];
  if (!actor || targetIndex < 0) return state;

  const neighborId =
    targetIndex > 0 ? requestedActorIds[targetIndex - 1] : requestedActorIds[1];
  const nextInitiative = neighborId
    ? state.actors.byId[neighborId]?.initiative
    : actor.initiative;
  const nextState: EncounterState = {
    ...state,
    actors: {
      ...state.actors,
      byId: {
        ...state.actors.byId,
        [actorId]: { ...actor, initiative: nextInitiative }
      }
    }
  };

  return {
    ...nextState,
    initiativeTracker: {
      ...state.initiativeTracker,
      actorIds: sortInitiativeActorIds(nextState, requestedActorIds)
    }
  };
}

function removeFromTracker(
  tracker: InitiativeTrackerState,
  actorId: EntityId
): InitiativeTrackerState {
  const removedIndex = tracker.actorIds.indexOf(actorId);
  if (removedIndex < 0) return tracker;

  const actorIds = tracker.actorIds.filter((id) => id !== actorId);
  if (tracker.currentActorId !== actorId) return { ...tracker, actorIds };
  if (actorIds.length === 0) {
    return { actorIds, currentActorId: null, currentRound: null };
  }

  const wrapped = removedIndex >= actorIds.length;
  return {
    actorIds,
    currentActorId: actorIds[wrapped ? 0 : removedIndex] ?? null,
    currentRound:
      wrapped && tracker.currentRound !== null
        ? tracker.currentRound + 1
        : tracker.currentRound
  };
}

export function removeActorFromInitiative(
  state: EncounterState,
  actorId: EntityId
): EncounterState {
  const initiativeTracker = removeFromTracker(state.initiativeTracker, actorId);
  return initiativeTracker === state.initiativeTracker
    ? state
    : { ...state, initiativeTracker };
}

export function clearInitiative(state: EncounterState): EncounterState {
  if (state.initiativeTracker.actorIds.length === 0) return state;
  return {
    ...state,
    initiativeTracker: { actorIds: [], currentActorId: null, currentRound: null }
  };
}

export function startInitiative(state: EncounterState): EncounterState {
  const firstActorId = state.initiativeTracker.actorIds[0];
  if (!firstActorId || state.initiativeTracker.currentActorId) return state;
  return {
    ...state,
    initiativeTracker: {
      ...state.initiativeTracker,
      currentActorId: firstActorId,
      currentRound: 1
    }
  };
}

export function endInitiative(state: EncounterState): EncounterState {
  if (state.initiativeTracker.currentActorId === null) return state;
  return {
    ...state,
    initiativeTracker: {
      ...state.initiativeTracker,
      currentActorId: null,
      currentRound: null
    }
  };
}

export function advanceInitiative(state: EncounterState): EncounterState {
  const { actorIds, currentActorId, currentRound } = state.initiativeTracker;
  const currentIndex = currentActorId ? actorIds.indexOf(currentActorId) : -1;
  if (currentIndex < 0 || currentRound === null || actorIds.length === 0) return state;
  const wrapped = currentIndex === actorIds.length - 1;
  return {
    ...state,
    initiativeTracker: {
      actorIds,
      currentActorId: actorIds[wrapped ? 0 : currentIndex + 1] ?? null,
      currentRound: wrapped ? currentRound + 1 : currentRound
    }
  };
}

export function retreatInitiative(state: EncounterState): EncounterState {
  const { actorIds, currentActorId, currentRound } = state.initiativeTracker;
  const currentIndex = currentActorId ? actorIds.indexOf(currentActorId) : -1;
  if (
    currentIndex < 0 ||
    currentRound === null ||
    actorIds.length === 0 ||
    (currentRound === 1 && currentIndex === 0)
  ) {
    return state;
  }
  const wrapped = currentIndex === 0;
  return {
    ...state,
    initiativeTracker: {
      actorIds,
      currentActorId: actorIds[wrapped ? actorIds.length - 1 : currentIndex - 1] ?? null,
      currentRound: wrapped ? currentRound - 1 : currentRound
    }
  };
}
