import { loadEncounterState, resetEncounterState } from "./encounterSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";
import type { Dispatch } from "redux";

import type { EncounterState } from "@core/encounter/types";
import type { EncounterActionRecord } from "@core/history/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { JsonObject } from "@core/history/types";
import { createValidationBlockLogEntry } from "@core/logging/formatEncounterLogEntry";
import type { PreparedValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import type {
  EncounterLogEntry,
  EncounterLogState
} from "@core/logging/types";

export type RecordEncounterValidationBlockPayload = {
  action: EncounterActionRecord;
  encounter: EncounterState;
};

const initialState: EncounterLogState = {
  showSystemLogs: false,
  encounterSession: 0,
  entries: []
};

function appendUniqueEntry(
  state: EncounterLogState,
  entry: EncounterLogEntry
): void {
  const existingIds = new Set(state.entries.map(({ id }) => id));
  let id = entry.id;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${entry.id}:${suffix}`;
    suffix += 1;
  }
  state.entries.push(id === entry.id ? entry : { ...entry, id });
}

const encounterLogSlice = createSlice({
  name: "encounterLog",
  initialState,
  extraReducers: builder => {
    // Reloading even the same encounter must discard its unsent composer draft.
    builder.addCase(loadEncounterState, state => { state.encounterSession += 1; });
    builder.addCase(resetEncounterState, state => { state.encounterSession += 1; });
  },
  reducers: {
    appendEncounterLogEntry(state, { payload }: PayloadAction<EncounterLogEntry>) {
      appendUniqueEntry(state, payload);
    },
    recordEncounterValidationBlock(
      state,
      { payload }: PayloadAction<RecordEncounterValidationBlockPayload>
    ) {
      appendUniqueEntry(
        state,
        createValidationBlockLogEntry(payload.action, payload.encounter)
      );
    },
    toggleSystemLogs(state) { state.showSystemLogs = !state.showSystemLogs; },
    resetEncounterLog(state) {
      state.entries = [];
    }
  }
});

export const {
  appendEncounterLogEntry,
  toggleSystemLogs,
  recordEncounterValidationBlock,
  resetEncounterLog
} = encounterLogSlice.actions;

/** Records hard pipeline rejection while ignoring an ASSISTED confirmation prompt. */
export function logEncounterValidationBlock(
  dispatch: Dispatch,
  prepared: PreparedValidatedEncounterChange
): boolean {
  if (!prepared.validationResult?.blocked) {
    return false;
  }

  dispatch(
    recordEncounterValidationBlock({
      action: prepared.action,
      encounter: prepared.nextEncounter
    })
  );
  return true;
}

/** Records a hard guard that rejects before the shared validation pipeline runs. */
export function logEncounterValidationFailure(
  dispatch: Dispatch,
  encounter: EncounterState,
  input: {
    actionType: string;
    code: string;
    message: string;
    payload?: JsonObject;
  }
): void {
  const action = createEncounterActionRecord(
    input.actionType,
    input.payload ?? {}
  );
  dispatch(
    recordEncounterValidationBlock({
      action: {
        ...action,
        validationResult: {
          blocked: true,
          messages: [
            {
              code: input.code,
              message: input.message,
              severity: "error"
            }
          ],
          valid: false
        }
      },
      encounter
    })
  );
}

export default encounterLogSlice.reducer;
