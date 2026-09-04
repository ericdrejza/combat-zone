import { beforeEach, describe, expect, it, vi } from "vitest";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange, redoEncounterChange, resetEncounterState, undoEncounterChange } from "@store/encounterSlice";
import {
  logEncounterValidationBlock,
  resetEncounterLog
} from "@store/encounterLogSlice";
import { store } from "@store/store";

describe("encounter log store", () => {
  beforeEach(() => {
    store.dispatch(resetEncounterState());
    store.dispatch(resetEncounterLog());
  });

  it("logs every successful encounter history commit centrally", () => {
    const current = store.getState().encounter.present;
    const action = {
      ...createEncounterActionRecord("background.add", {}),
      id: "background-action",
      timestamp: 42
    };

    store.dispatch(
      commitEncounterChange({
        action,
        nextEncounter: {
          ...current,
          backgroundImage: {
            source: { kind: "embedded", dataUrl: "data:image/png;base64,AA==" },
            height: 100,
            mediaType: "image/png",
            name: "Battle Map",
            width: 100
          }
        }
      })
    );

    expect(store.getState().encounterLog.entries).toEqual([
      {
        actionId: "background-action",
        actionType: "background.add",
        category: "background",
        id: "background-action:commit",
        kind: "commit",
        message: "Battle Map added as the background.",
        timestamp: 42
      }
    ]);
  });

  it("keeps entry ids unique when action records collide in one millisecond", () => {
    const current = store.getState().encounter.present;
    const action = {
      ...createEncounterActionRecord("background.add", {}),
      id: "same-action",
      timestamp: 42
    };
    const payload = { action, nextEncounter: current };

    store.dispatch(commitEncounterChange(payload));
    store.dispatch(commitEncounterChange(payload));

    expect(store.getState().encounterLog.entries.map(({ id }) => id)).toEqual([
      "same-action:commit",
      "same-action:commit:2"
    ]);
  });

  it("logs effective undo and redo operations but ignores empty history actions", () => {
    const current = store.getState().encounter.present;
    const action = {
      ...createEncounterActionRecord("background.delete", {}),
      id: "delete-background"
    };
    store.dispatch(
      commitEncounterChange({
        action,
        nextEncounter: { ...current, backgroundImage: null }
      })
    );
    store.dispatch(undoEncounterChange());
    store.dispatch(redoEncounterChange());
    store.dispatch(redoEncounterChange());

    expect(
      store.getState().encounterLog.entries.map(({ kind, message }) => ({
        kind,
        message
      }))
    ).toEqual([
      { kind: "commit", message: "Background deleted." },
      { kind: "history", message: "Undid: Background deleted." },
      { kind: "history", message: "Redid: Background deleted." }
    ]);
  });

  it("does not log an ASSISTED confirmation as a rejected action", () => {
    const dispatch = vi.fn();
    const encounter = store.getState().encounter.present;
    const action = createEncounterActionRecord("actor.updateProperties", {});

    expect(
      logEncounterValidationBlock(
        dispatch,
        {
          action,
          blocked: true,
          nextEncounter: encounter,
          requiresConfirmation: true,
          validationResult: {
            blocked: false,
            messages: [],
            mode: "ASSISTED",
            valid: true
          }
        }
      )
    ).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("logs a hard pipeline rejection without committing encounter history", () => {
    const encounter = store.getState().encounter.present;
    const action = {
      ...createEncounterActionRecord("actor.move", {
        actorIds: ["missing-actor"],
        destinationZoneId: "missing-zone"
      }),
      validationResult: {
        blocked: true,
        messages: [
          {
            code: "movement.actorMissing",
            message: "Movement references an actor that does not exist.",
            severity: "error" as const
          }
        ],
        valid: false
      }
    };

    expect(
      logEncounterValidationBlock(store.dispatch, {
        action,
        blocked: true,
        nextEncounter: encounter,
        requiresConfirmation: false,
        validationResult: {
          ...action.validationResult,
          mode: "STRICT"
        }
      })
    ).toBe(true);
    expect(store.getState().encounter.past).toHaveLength(0);
    expect(store.getState().encounterLog.entries).toEqual([
      expect.objectContaining({
        actionType: "actor.move",
        category: "validation",
        kind: "validation-block"
      })
    ]);
  });
});
