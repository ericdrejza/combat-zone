import { rulersEqual } from '@core/measurement/rulerEquality';
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice, original } from "@reduxjs/toolkit";

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
      if (payload.nextEncounter === original(state.present)) return;
      const nextEncounter = payload.action.validationResult
        ? {
            ...payload.nextEncounter,
            validationState: {
              ...payload.nextEncounter.validationState,
              messages: payload.action.validationResult.messages
            }
          }
        : payload.nextEncounter;

      const last = state.past.at(-1), groupId = payload.action.payload.groupId;
      const groupedAppearance = payload.action.type === 'ruler.appearance' && typeof groupId === 'string'
        && !state.future.length && last?.action.type === payload.action.type && last.action.payload.groupId === groupId;
      if (!groupedAppearance) state.past.push({ action: payload.action, snapshot: state.present });
      state.present = nextEncounter;
      if (groupedAppearance && last && rulersEqual(last.snapshot.rulers.allIds.map(id => last.snapshot.rulers.byId[id]), nextEncounter.rulers.allIds.map(id => nextEncounter.rulers.byId[id]))) {
        state.past.pop(); state.present = last.snapshot;
      }
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
