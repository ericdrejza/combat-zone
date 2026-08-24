import { describe, expect, it } from "vitest";

import { ENCOUNTER_SCHEMA_VERSION } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";
import {
  canRedoEncounterHistory,
  canUndoEncounterHistory
} from "@core/history/types";
import reducer, {
  clearEncounterHistory,
  commitEncounterChange,
  loadEncounterState,
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";

function actionRecord(sequence: number): EncounterActionRecord {
  return {
    id: `history-action-${sequence}`,
    type: "test.renameEncounter",
    timestamp: sequence,
    payload: {
      name: `Encounter ${sequence}`
    },
    validationResult: {
      valid: true,
      messages: []
    }
  };
}

function renamePresentEncounter(
  state: ReturnType<typeof reducer>,
  sequence: number
) {
  return {
    ...state.present,
    name: `Encounter ${sequence}`
  };
}

describe("encounter Redux history", () => {
  it("initializes history around the current encounter snapshot", () => {
    const state = reducer(undefined, { type: "test/init" });

    expect(state).toEqual({
      past: [],
      present: {
        schemaVersion: ENCOUNTER_SCHEMA_VERSION,
        id: "active-encounter",
        name: "Untitled Encounter",
        backgroundImage: null,
        canvasSize: { height: 640, width: 960 },
        zones: { byId: {}, allIds: [] },
        edges: { byId: {}, allIds: [] },
        actors: { byId: {}, allIds: [] },
        engagements: { byId: {}, allIds: [] },
        annotations: { byId: {}, allIds: [] },
        initiativeTracker: {
          entries: [],
          currentActorId: null,
          currentRound: null
        },
        validationState: {
          mode: "ADVISORY",
          messages: []
        }
      },
      future: []
    });
    expect(canUndoEncounterHistory(state)).toBe(false);
    expect(canRedoEncounterHistory(state)).toBe(false);
  });

  it("commits serializable action metadata and restores snapshots with undo and redo", () => {
    const initialState = reducer(undefined, { type: "test/init" });
    const nextEncounter = renamePresentEncounter(initialState, 1);
    const action = actionRecord(1);

    const committedState = reducer(
      initialState,
      commitEncounterChange({
        action,
        nextEncounter
      })
    );

    expect(committedState.present).toEqual(nextEncounter);
    expect(committedState.past).toEqual([
      {
        action,
        snapshot: initialState.present
      }
    ]);
    expect(JSON.parse(JSON.stringify(committedState.past[0].action))).toEqual(
      action
    );
    expect(canUndoEncounterHistory(committedState)).toBe(true);

    const undoneState = reducer(committedState, undoEncounterChange());

    expect(undoneState.present).toEqual(initialState.present);
    expect(undoneState.future).toEqual([
      {
        action,
        snapshot: nextEncounter
      }
    ]);
    expect(canRedoEncounterHistory(undoneState)).toBe(true);

    const redoneState = reducer(undoneState, redoEncounterChange());

    expect(redoneState.present).toEqual(nextEncounter);
    expect(redoneState.past).toEqual([
      {
        action,
        snapshot: initialState.present
      }
    ]);
    expect(redoneState.future).toEqual([]);
  });

  it("does nothing when undo or redo has no available snapshot", () => {
    const initialState = reducer(undefined, { type: "test/init" });

    expect(reducer(initialState, undoEncounterChange())).toEqual(initialState);
    expect(reducer(initialState, redoEncounterChange())).toEqual(initialState);
  });

  it("loads a persisted encounter with fresh undo and redo history", () => {
    const initialState = reducer(undefined, { type: "test/init" });
    const loadedEncounter = {
      ...initialState.present,
      id: "persisted-encounter",
      name: "Persisted Encounter"
    };
    const committedState = reducer(
      initialState,
      commitEncounterChange({
        action: actionRecord(1),
        nextEncounter: renamePresentEncounter(initialState, 1)
      })
    );

    expect(reducer(committedState, loadEncounterState(loadedEncounter))).toEqual({
      past: [],
      present: loadedEncounter,
      future: []
    });
  });

  it("truncates redo history when committing after undo", () => {
    const initialState = reducer(undefined, { type: "test/init" });
    const firstState = reducer(
      initialState,
      commitEncounterChange({
        action: actionRecord(1),
        nextEncounter: renamePresentEncounter(initialState, 1)
      })
    );
    const secondState = reducer(
      firstState,
      commitEncounterChange({
        action: actionRecord(2),
        nextEncounter: renamePresentEncounter(firstState, 2)
      })
    );
    const undoneState = reducer(secondState, undoEncounterChange());
    const replacementEncounter = {
      ...undoneState.present,
      name: "Replacement Encounter"
    };
    const replacementState = reducer(
      undoneState,
      commitEncounterChange({
        action: {
          ...actionRecord(3),
          payload: {
            name: "Replacement Encounter"
          }
        },
        nextEncounter: replacementEncounter
      })
    );

    expect(undoneState.future).toHaveLength(1);
    expect(replacementState.present).toEqual(replacementEncounter);
    expect(replacementState.future).toEqual([]);
    expect(reducer(replacementState, redoEncounterChange())).toEqual(
      replacementState
    );
  });

  it("returns to the exact original state after 10 rapid commits and 10 undos, then redoes exactly", () => {
    let state = reducer(undefined, { type: "test/init" });
    const snapshots = [state.present];

    for (let sequence = 1; sequence <= 10; sequence += 1) {
      const nextEncounter = renamePresentEncounter(state, sequence);

      state = reducer(
        state,
        commitEncounterChange({
          action: actionRecord(sequence),
          nextEncounter
        })
      );
      snapshots.push(nextEncounter);
    }

    expect(state.past).toHaveLength(10);
    expect(state.present).toEqual(snapshots[10]);

    for (let sequence = 9; sequence >= 0; sequence -= 1) {
      state = reducer(state, undoEncounterChange());
      expect(state.present).toEqual(snapshots[sequence]);
    }

    expect(state.present).toEqual(snapshots[0]);
    expect(state.future).toHaveLength(10);

    for (let sequence = 1; sequence <= 10; sequence += 1) {
      state = reducer(state, redoEncounterChange());
      expect(state.present).toEqual(snapshots[sequence]);
    }

    expect(state.future).toEqual([]);
    expect(state.present).toEqual(snapshots[10]);
  });

  it("clears history without changing the current encounter", () => {
    const initialState = reducer(undefined, { type: "test/init" });
    const committedState = reducer(
      initialState,
      commitEncounterChange({
        action: actionRecord(1),
        nextEncounter: renamePresentEncounter(initialState, 1)
      })
    );
    const clearedState = reducer(committedState, clearEncounterHistory());

    expect(clearedState.present).toEqual(committedState.present);
    expect(clearedState.past).toEqual([]);
    expect(clearedState.future).toEqual([]);
  });

  it("plumbs committed validation results into the current encounter snapshot", () => {
    const initialState = reducer(undefined, { type: "test/init" });
    const nextEncounter = {
      ...renamePresentEncounter(initialState, 1),
      validationState: {
        mode: "ADVISORY" as const,
        messages: []
      }
    };
    const validationMessage = {
      code: "movement.destinationZoneMissing",
      message: "Movement references a destination zone that does not exist.",
      severity: "error" as const
    };
    const committedState = reducer(
      initialState,
      commitEncounterChange({
        action: {
          ...actionRecord(1),
          validationResult: {
            valid: false,
            messages: [validationMessage]
          }
        },
        nextEncounter
      })
    );

    expect(committedState.present.validationState.messages).toEqual([
      validationMessage
    ]);
    expect(committedState.past[0].snapshot.validationState.messages).toEqual(
      []
    );
  });
});
