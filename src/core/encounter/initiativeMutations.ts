import type { EntityId } from "@core/state/entityCollection";
import type {
  EncounterState,
  InitiativeEntry,
  InitiativeTrackerState
} from "./types";

export const INITIATIVE_MIN = -10;
export const INITIATIVE_MAX = 99;

export {
  advanceInitiative,
  endInitiative,
  retreatInitiative,
  setCurrentInitiativeActor,
  startInitiative
} from "./initiativeTurnMutations";

export function getInitiativeActorIds(state: EncounterState): EntityId[] {
  return state.initiativeTracker.entries.map(({ actorId }) => actorId);
}

export function getInitiativeEntry(
  state: EncounterState,
  actorId: EntityId
): InitiativeEntry | undefined {
  return state.initiativeTracker.entries.find(
    (entry) => entry.actorId === actorId
  );
}

/** Keeps values descending while retaining persisted order within ties. */
export function sortInitiativeEntries(
  entries: InitiativeEntry[]
): InitiativeEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.value === undefined && right.entry.value === undefined) {
        return left.index - right.index;
      }
      if (left.entry.value === undefined) return 1;
      if (right.entry.value === undefined) return -1;
      return right.entry.value - left.entry.value || left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function alphabetizeActorIds(state: EncounterState, actorIds: EntityId[]) {
  return [...actorIds].sort((leftId, rightId) => {
    const leftName = state.actors.byId[leftId]?.name ?? leftId;
    const rightName = state.actors.byId[rightId]?.name ?? rightId;
    return leftName.localeCompare(rightName) || leftId.localeCompare(rightId);
  });
}

/** Adds an alphabetized batch of blank, tracker-owned initiative entries. */
export function addActorsToInitiative(
  state: EncounterState,
  actorIds: EntityId[]
): EncounterState {
  const existingIds = new Set(getInitiativeActorIds(state));
  const uniqueNewIds = [...new Set(actorIds)].filter(
    (actorId) => state.actors.byId[actorId] && !existingIds.has(actorId)
  );
  if (uniqueNewIds.length === 0) return state;

  const entries = sortInitiativeEntries([
    ...state.initiativeTracker.entries,
    ...alphabetizeActorIds(state, uniqueNewIds).map((actorId) => ({ actorId }))
  ]);
  return {
    ...state,
    initiativeTracker: {
      ...state.initiativeTracker,
      entries,
      currentActorId:
        state.initiativeTracker.currentRound !== null &&
        state.initiativeTracker.currentActorId === null
          ? entries[0]?.actorId ?? null
          : state.initiativeTracker.currentActorId
    }
  };
}

export function updateInitiativeValue(
  state: EncounterState,
  actorId: EntityId,
  value: number | undefined
): EncounterState {
  const entry = getInitiativeEntry(state, actorId);
  if (!entry || entry.value === value) return state;

  const entries = sortInitiativeEntries(
    state.initiativeTracker.entries.map((candidate) =>
      candidate.actorId === actorId ? { actorId, value } : candidate
    )
  );
  return {
    ...state,
    initiativeTracker: { ...state.initiativeTracker, entries }
  };
}

/** Applies a drop order and derives the dragged entry's value from its neighbor. */
export function reorderInitiativeActor(
  state: EncounterState,
  actorId: EntityId,
  requestedActorIds: EntityId[]
): EncounterState {
  const currentIds = getInitiativeActorIds(state);
  if (
    requestedActorIds.length !== currentIds.length ||
    new Set(requestedActorIds).size !== currentIds.length ||
    requestedActorIds.some((id) => !currentIds.includes(id))
  ) {
    return state;
  }

  const targetIndex = requestedActorIds.indexOf(actorId);
  const entry = getInitiativeEntry(state, actorId);
  if (!entry || targetIndex < 0) return state;

  const entriesByActorId = new Map(
    state.initiativeTracker.entries.map((candidate) => [candidate.actorId, candidate])
  );
  const requestedEntries = requestedActorIds.map(
    (requestedId) => entriesByActorId.get(requestedId)!
  );
  const neighbor =
    targetIndex > 0 ? requestedEntries[targetIndex - 1] : requestedEntries[1];
  const entries = sortInitiativeEntries(
    requestedEntries.map((candidate) =>
      candidate.actorId === actorId
        ? { actorId, value: neighbor ? neighbor.value : entry.value }
        : candidate
    )
  );

  return {
    ...state,
    initiativeTracker: { ...state.initiativeTracker, entries }
  };
}

function removeFromTracker(
  tracker: InitiativeTrackerState,
  actorId: EntityId
): InitiativeTrackerState {
  const removedIndex = tracker.entries.findIndex(
    (entry) => entry.actorId === actorId
  );
  if (removedIndex < 0) return tracker;

  const entries = tracker.entries.filter((entry) => entry.actorId !== actorId);
  if (tracker.currentActorId !== actorId) return { ...tracker, entries };
  if (entries.length === 0) {
    return { entries, currentActorId: null, currentRound: tracker.currentRound };
  }

  const wrapped = removedIndex >= entries.length;
  return {
    entries,
    currentActorId: entries[wrapped ? 0 : removedIndex]?.actorId ?? null,
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

export function removeActorsFromInitiative(
  state: EncounterState,
  actorIds: EntityId[]
): EncounterState {
  const idsToRemove = new Set(actorIds);
  const presentIds = getInitiativeActorIds(state).filter((id) =>
    idsToRemove.has(id)
  );
  if (presentIds.length === 0) return state;

  let nextState = state;
  for (const actorId of presentIds) {
    nextState = removeActorFromInitiative(nextState, actorId);
  }
  if (
    nextState.initiativeTracker.entries.length === 0 &&
    state.initiativeTracker.currentRound !== null
  ) {
    return {
      ...nextState,
      initiativeTracker: {
        ...nextState.initiativeTracker,
        currentActorId: null,
        currentRound: state.initiativeTracker.currentRound
      }
    };
  }
  return nextState;
}

export function clearInitiative(state: EncounterState): EncounterState {
  if (state.initiativeTracker.entries.length === 0) return state;
  return {
    ...state,
    initiativeTracker: {
      entries: [],
      currentActorId: null,
      currentRound: state.initiativeTracker.currentRound
    }
  };
}
