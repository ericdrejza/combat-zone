import type { PayloadAction } from "@reduxjs/toolkit";
import { createSlice } from "@reduxjs/toolkit";

import type {
  EntitySelection,
  SelectableEntityType,
  SelectionState
} from "./selection/types";
import {
  canToolSelectEntityType,
  type ToolId
} from "./tools/toolRegistry";

export type BoxSelection = {
  start: {
    x: number;
    y: number;
  };
  current: {
    x: number;
    y: number;
  };
};

export type ContextualActionRequest = {
  entityId: string;
  entityType: SelectableEntityType;
  toolId: ToolId;
};

export type InteractionDraftState = {
  boxSelection: BoxSelection | null;
  polygonPointIds: string[];
};

export type InteractionState = {
  activeToolId: ToolId;
  selection: SelectionState;
  draft: InteractionDraftState;
  contextualActionRequest: ContextualActionRequest | null;
};

export type SelectEntityPayload = EntitySelection & {
  toggle?: boolean;
};

export type FinishBoxSelectionPayload = EntitySelection & {
  additive?: boolean;
};

const initialSelection: SelectionState = {
  selectedEntityType: null,
  selectedIds: [],
  overlayTargets: []
};

const initialDraft: InteractionDraftState = {
  boxSelection: null,
  polygonPointIds: []
};

const initialState: InteractionState = {
  activeToolId: "select",
  selection: initialSelection,
  draft: initialDraft,
  contextualActionRequest: null
};

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function canSelect(
  state: InteractionState,
  entityType: SelectableEntityType
): boolean {
  return canToolSelectEntityType(state.activeToolId, entityType);
}

function selectIds(
  state: InteractionState,
  entityType: SelectableEntityType,
  ids: string[],
  additive: boolean
) {
  if (!canSelect(state, entityType)) {
    return;
  }

  const nextIds =
    additive && state.selection.selectedEntityType === entityType
      ? unique([...state.selection.selectedIds, ...ids])
      : unique(ids);

  state.selection = {
    ...state.selection,
    selectedEntityType: nextIds.length > 0 ? entityType : null,
    selectedIds: nextIds
  };
}

export const interactionSlice = createSlice({
  name: "interaction",
  initialState,
  reducers: {
    setActiveTool(state, { payload }: PayloadAction<ToolId>) {
      state.activeToolId = payload;
      state.draft = initialDraft;
      state.contextualActionRequest = null;

      if (
        state.selection.selectedEntityType &&
        !canToolSelectEntityType(payload, state.selection.selectedEntityType)
      ) {
        state.selection = initialSelection;
      }
    },
    clearInteractionDraft(state) {
      state.draft = initialDraft;
      state.contextualActionRequest = null;
    },
    selectEntity(state, { payload }: PayloadAction<SelectEntityPayload>) {
      if (!canSelect(state, payload.entityType)) {
        return;
      }

      if (!payload.toggle) {
        selectIds(state, payload.entityType, payload.ids, false);
        return;
      }

      if (state.selection.selectedEntityType !== payload.entityType) {
        selectIds(state, payload.entityType, payload.ids, false);
        return;
      }

      const idsToToggle = new Set(payload.ids);
      const retainedIds = state.selection.selectedIds.filter(
        (id) => !idsToToggle.has(id)
      );
      const idsToAdd = payload.ids.filter(
        (id) => !state.selection.selectedIds.includes(id)
      );
      const nextIds = [...retainedIds, ...idsToAdd];

      state.selection = {
        ...state.selection,
        selectedEntityType: nextIds.length > 0 ? payload.entityType : null,
        selectedIds: nextIds
      };
    },
    clearSelection(state) {
      state.selection = initialSelection;
      state.contextualActionRequest = null;
    },
    requestContextualAction(
      state,
      { payload }: PayloadAction<Pick<ContextualActionRequest, "entityId" | "entityType">>
    ) {
      if (!canSelect(state, payload.entityType)) {
        return;
      }

      state.contextualActionRequest = {
        ...payload,
        toolId: state.activeToolId
      };
    },
    startBoxSelection(
      state,
      { payload }: PayloadAction<BoxSelection["start"]>
    ) {
      state.draft.boxSelection = {
        start: payload,
        current: payload
      };
    },
    updateBoxSelection(
      state,
      { payload }: PayloadAction<BoxSelection["current"]>
    ) {
      if (!state.draft.boxSelection) {
        return;
      }

      state.draft.boxSelection.current = payload;
    },
    finishBoxSelection(
      state,
      { payload }: PayloadAction<FinishBoxSelectionPayload>
    ) {
      selectIds(state, payload.entityType, payload.ids, payload.additive ?? false);
      state.draft.boxSelection = null;
    },
    setPolygonDraftPointIds(state, { payload }: PayloadAction<string[]>) {
      state.draft.polygonPointIds = payload;
    }
  }
});

export const {
  clearInteractionDraft,
  clearSelection,
  finishBoxSelection,
  requestContextualAction,
  selectEntity,
  setActiveTool,
  setPolygonDraftPointIds,
  startBoxSelection,
  updateBoxSelection
} = interactionSlice.actions;

export default interactionSlice.reducer;
