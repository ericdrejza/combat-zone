import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import { createEncounterState } from "@core/encounter/createEncounterState";
import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";
import { createEncounterHistoryState } from "@core/history/types";

export type CommitEncounterChangePayload = {
  action: EncounterActionRecord;
  nextEncounter: EncounterState;
};

const initialEncounterState = createEncounterState({
  id: "active-encounter",
  name: "Untitled Encounter"
});

const initialState = createEncounterHistoryState(initialEncounterState);

const encounterSlice = createSlice({
  name: "encounter",
  initialState,
  reducers: {
    commitEncounterChange(
      state,
      { payload }: PayloadAction<CommitEncounterChangePayload>
    ) {
      const nextEncounter = payload.action.validationResult
        ? {
            ...payload.nextEncounter,
            validationState: {
              ...payload.nextEncounter.validationState,
              messages: payload.action.validationResult.messages
            }
          }
        : payload.nextEncounter;

      state.past.push({
        action: payload.action,
        snapshot: state.present
      });
      state.present = nextEncounter;
      state.future = [];
    },
    undoEncounterChange(state) {
      const previousEntry = state.past.pop();

      if (!previousEntry) {
        return;
      }

      state.future.unshift({
        action: previousEntry.action,
        snapshot: state.present
      });
      state.present = previousEntry.snapshot;
    },
    redoEncounterChange(state) {
      const nextEntry = state.future.shift();

      if (!nextEntry) {
        return;
      }

      state.past.push({
        action: nextEntry.action,
        snapshot: state.present
      });
      state.present = nextEntry.snapshot;
    },
    clearEncounterHistory(state) {
      state.past = [];
      state.future = [];
    },
    loadEncounterState(_state, { payload }: PayloadAction<EncounterState>) {
      return createEncounterHistoryState(payload);
    },
    resetEncounterState() {
      return initialState;
    }
  }
});

export const {
  clearEncounterHistory,
  commitEncounterChange,
  loadEncounterState,
  redoEncounterChange,
  resetEncounterState,
  undoEncounterChange
} = encounterSlice.actions;

export default encounterSlice.reducer;
