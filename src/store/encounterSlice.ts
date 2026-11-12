import type { ChatMessage } from "@core/chat/types";
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

/** Reuse unchanged snapshots while keeping chat outside the historical timeline. */
function retainChat(snapshot: EncounterState, chatMessages: EncounterState["chatMessages"]): EncounterState {
  return snapshot.chatMessages === chatMessages ? snapshot : { ...snapshot, chatMessages };
}

const initialEncounterState = createEncounterState({
  id: "active-encounter",
  name: "Untitled Encounter"
});

const initialState = createEncounterHistoryState(initialEncounterState);

const encounterSlice = createSlice({
  name: "encounter",
  initialState,
  reducers: {
    // Chat is durable but independent of the undo/redo timeline.
    sendChatMessage(state, { payload }: PayloadAction<ChatMessage>) {
      if (state.present.chatMessages.byId[payload.id]) return;
      state.present.chatMessages.byId[payload.id] = payload;
      state.present.chatMessages.allIds.push(payload.id);
    },
    deleteChatMessage(state, { payload }: PayloadAction<string>) {
      if (!state.present.chatMessages.byId[payload]) return;
      delete state.present.chatMessages.byId[payload];
      state.present.chatMessages.allIds = state.present.chatMessages.allIds.filter(id => id !== payload);
    },
    clearChatMessages(state) {
      if (!state.present.chatMessages.allIds.length) return;
      state.present.chatMessages = { byId: {}, allIds: [] };
    },
    commitEncounterChange(
      state,
      { payload }: PayloadAction<CommitEncounterChangePayload>
    ) {
      if (payload.nextEncounter === original(state.present)) return;
      const currentChat = original(state.present)!.chatMessages;
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
      state.present = retainChat(nextEncounter, currentChat);
      if (groupedAppearance && last && rulersEqual(last.snapshot.rulers.allIds.map(id => last.snapshot.rulers.byId[id]), nextEncounter.rulers.allIds.map(id => nextEncounter.rulers.byId[id]))) {
        state.past.pop(); state.present = retainChat(original(last.snapshot)!, currentChat);
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
      state.present = retainChat(original(previousEntry.snapshot)!, original(state.present)!.chatMessages);
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
      state.present = retainChat(original(nextEntry.snapshot)!, original(state.present)!.chatMessages);
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
  sendChatMessage,
  deleteChatMessage,
  clearChatMessages,
  clearEncounterHistory,
  commitEncounterChange,
  loadEncounterState,
  redoEncounterChange,
  resetEncounterState,
  undoEncounterChange
} = encounterSlice.actions;

export default encounterSlice.reducer;
