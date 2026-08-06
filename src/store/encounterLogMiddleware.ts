import type { Middleware } from "@reduxjs/toolkit";

import type { EncounterHistoryState } from "@core/history/types";
import {
  createCommittedEncounterLogEntry,
  formatCommittedEncounterAction
} from "@core/logging/formatEncounterLogEntry";
import type { EncounterLogEntry } from "@core/logging/types";
import {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from "./encounterSlice";
import { appendEncounterLogEntry } from "./encounterLogSlice";

type StateWithEncounter = {
  encounter: EncounterHistoryState;
};

/** Captures every successful history commit without coupling mutation callers to logging. */
export const encounterLogMiddleware: Middleware<unknown, StateWithEncounter> =
  (storeApi) => (next) => (action) => {
    const isCommit = commitEncounterChange.match(action);
    const isUndo = undoEncounterChange.match(action);
    const isRedo = redoEncounterChange.match(action);
    if (!isCommit && !isUndo && !isRedo) {
      return next(action);
    }

    const historyBefore = storeApi.getState().encounter;
    const before = historyBefore.present;
    const historicalAction = isUndo
      ? historyBefore.past[historyBefore.past.length - 1]?.action
      : isRedo
        ? historyBefore.future[0]?.action
        : undefined;
    const result = next(action);
    const after = storeApi.getState().encounter.present;

    if ((isUndo || isRedo) && !historicalAction) {
      return result;
    }

    if (historicalAction) {
      const operation = isUndo ? "undo" : "redo";
      const timestamp = Date.now();
      const originalMessage = formatCommittedEncounterAction(
        historicalAction,
        isUndo
          ? { before: after, after: before }
          : { before, after }
      );
      const logEntry: EncounterLogEntry = {
        actionId: historicalAction.id,
        actionType: `history.${operation}`,
        category: "encounter",
        id: `${historicalAction.id}:${operation}:${timestamp}`,
        kind: "history",
        message: `${isUndo ? "Undid" : "Redid"}: ${originalMessage}`,
        timestamp
      };
      storeApi.dispatch(appendEncounterLogEntry(logEntry));
      return result;
    }

    if (!isCommit) {
      return result;
    }

    storeApi.dispatch(
      appendEncounterLogEntry(
        createCommittedEncounterLogEntry(action.payload.action, {
          before,
          after
        })
      )
    );
    return result;
  };
