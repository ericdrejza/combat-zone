import type { EntityId } from "@core/state/entityCollection";
import { getActorStatus } from "@entities/actor/actorStatus";
import type { EncounterState } from "./types";

export function startInitiative(state: EncounterState): EncounterState {
  const firstActorId = state.initiativeTracker.entries.find(({ actorId }) => {
    const actor = state.actors.byId[actorId];
    return actor && getActorStatus(actor) !== 0;
  })?.actorId;
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

export function setCurrentInitiativeActor(
  state: EncounterState,
  actorId: EntityId
): EncounterState {
  const { currentActorId, currentRound, entries } = state.initiativeTracker;
  if (
    currentRound === null ||
    currentActorId === null ||
    !entries.some((entry) => entry.actorId === actorId) ||
    currentActorId === actorId
  ) {
    return state;
  }
  return {
    ...state,
    initiativeTracker: { ...state.initiativeTracker, currentActorId: actorId }
  };
}

export function endInitiative(state: EncounterState): EncounterState {
  if (state.initiativeTracker.currentRound === null) return state;
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
  const { currentRound, entries } = state.initiativeTracker;
  if (entries.length === 0 && currentRound !== null) {
    return {
      ...state,
      initiativeTracker: {
        entries,
        currentActorId: null,
        currentRound: currentRound + 1
      }
    };
  }
  return stepInitiative(state, 1);
}

export function retreatInitiative(state: EncounterState): EncounterState {
  const { currentRound, entries } = state.initiativeTracker;
  if (entries.length === 0 && currentRound !== null) {
    if (currentRound === 1) return state;
    return {
      ...state,
      initiativeTracker: {
        entries,
        currentActorId: null,
        currentRound: currentRound - 1
      }
    };
  }
  return stepInitiative(state, -1);
}

/** Walks at most one round, retaining dead entries and respecting round one's start. */
function stepInitiative(state: EncounterState, direction: -1 | 1): EncounterState {
  const { entries, currentActorId, currentRound } = state.initiativeTracker;
  const currentIndex = entries.findIndex(({ actorId }) => actorId === currentActorId);
  if (currentIndex < 0 || currentRound === null) return state;
  for (let distance = 1; distance <= entries.length; distance++) {
    const rawIndex = currentIndex + direction * distance;
    const round = currentRound + Math.floor(rawIndex / entries.length);
    if (round < 1) return state;
    const index = (rawIndex + entries.length) % entries.length;
    const actorId = entries[index].actorId;
    const actor = state.actors.byId[actorId];
    if (!actor || getActorStatus(actor) === 0) continue;
    return {
      ...state,
      initiativeTracker: { entries, currentActorId: actorId, currentRound: round }
    };
  }
  return state;
}
