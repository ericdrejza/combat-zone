import type { EntityId } from "@core/state/entityCollection";
import type { EncounterState } from "./types";

export function startInitiative(state: EncounterState): EncounterState {
  const firstActorId = state.initiativeTracker.entries[0]?.actorId;
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
  const { currentActorId, currentRound, entries } = state.initiativeTracker;
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
  const currentIndex = entries.findIndex(({ actorId }) => actorId === currentActorId);
  if (currentIndex < 0 || currentRound === null) return state;
  const wrapped = currentIndex === entries.length - 1;
  return {
    ...state,
    initiativeTracker: {
      entries,
      currentActorId: entries[wrapped ? 0 : currentIndex + 1]?.actorId ?? null,
      currentRound: wrapped ? currentRound + 1 : currentRound
    }
  };
}

export function retreatInitiative(state: EncounterState): EncounterState {
  const { currentActorId, currentRound, entries } = state.initiativeTracker;
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
  const currentIndex = entries.findIndex(({ actorId }) => actorId === currentActorId);
  if (
    currentIndex < 0 ||
    currentRound === null ||
    (currentRound === 1 && currentIndex === 0)
  ) {
    return state;
  }
  const wrapped = currentIndex === 0;
  return {
    ...state,
    initiativeTracker: {
      entries,
      currentActorId:
        entries[wrapped ? entries.length - 1 : currentIndex - 1]?.actorId ?? null,
      currentRound: wrapped ? currentRound - 1 : currentRound
    }
  };
}
