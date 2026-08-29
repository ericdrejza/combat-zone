import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type {
  ActorLayoutGroup,
  ActorShape,
  ActorSize
} from '@entities/actor/types';
import type {
  EntitySelection,
  SelectableEntityType,
  SelectionState
} from './selection/types';
import { canToolSelectEntityType, type ToolId } from './tools/toolRegistry';
import type { ZoneShape } from '@entities/zone/types';
import {
  DEFAULT_EDGE_PRESET,
  type EdgePreset
} from '@entities/edge/edgeMutations';
import type {
  EdgeDirectionality,
  EdgeMovementRule,
  EdgeShape,
  EdgeVisibilityRule
} from '@entities/edge/types';

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

export type ZonePaintBrushState = {
  sourceZoneId: string;
};

export type ActorToolState = {
  clipboardActorId: string | null;
  layoutGroup: ActorLayoutGroup;
  shape: ActorShape;
  size: ActorSize;
  targetZoneId: string | null;
};

export type InteractionState = {
  actorPaintBrush: boolean;
  actorTool: ActorToolState;
  activeToolId: ToolId;
  /** Session-only modifier used by touch selection controls. */
  touchMultiSelect: boolean;
  dragActionPreview: 'engage' | 'disengage' | null;
  edgeTool: EdgePreset;
  selection: SelectionState;
  draft: InteractionDraftState;
  contextualActionRequest: ContextualActionRequest | null;
  lastZoneOpacity: number;
  zonePaintBrush: ZonePaintBrushState | null;
  zoneShapeMode: ZoneShape;
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
  actorPaintBrush: false,
  actorTool: {
    clipboardActorId: null,
    layoutGroup: 'hero',
    shape: 'circle',
    size: 'medium',
    targetZoneId: null
  },
  activeToolId: 'zone',
  touchMultiSelect: false,
  dragActionPreview: null,
  edgeTool: DEFAULT_EDGE_PRESET,
  selection: initialSelection,
  draft: initialDraft,
  contextualActionRequest: null,
  lastZoneOpacity: 0,
  zonePaintBrush: null,
  zoneShapeMode: 'rectangle'
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
  name: 'interaction',
  initialState,
  reducers: {
    setActiveTool(state, { payload }: PayloadAction<ToolId>) {
      state.activeToolId = payload;
      state.dragActionPreview = null;
      state.draft = initialDraft;
      state.contextualActionRequest = null;
      state.actorPaintBrush = false;
      state.zonePaintBrush = null;
      state.actorTool.targetZoneId = null;

      if (
        state.selection.selectedEntityType &&
        !canToolSelectEntityType(payload, state.selection.selectedEntityType)
      ) {
        state.selection = initialSelection;
      }
    },
    setTouchMultiSelect(state, { payload }: PayloadAction<boolean>) {
      state.touchMultiSelect = payload;
    },
    toggleTouchMultiSelect(state) {
      state.touchMultiSelect = !state.touchMultiSelect;
    },
    clearInteractionDraft(state) {
      state.draft = initialDraft;
      state.dragActionPreview = null;
      state.contextualActionRequest = null;
      state.actorPaintBrush = false;
      state.zonePaintBrush = null;
      state.actorTool.targetZoneId = null;
    },
    setActorToolLayoutGroup(state, { payload }: PayloadAction<ActorLayoutGroup>) {
      state.actorTool.layoutGroup = payload;
    },
    setActorToolSize(state, { payload }: PayloadAction<ActorSize>) {
      state.actorTool.size = payload;
    },
    setActorToolShape(state, { payload }: PayloadAction<ActorShape>) {
      state.actorTool.shape = payload;
    },
    setActorToolTargetZone(state, { payload }: PayloadAction<string | null>) {
      state.actorTool.targetZoneId = payload;
    },
    setActorClipboardActor(state, { payload }: PayloadAction<string | null>) {
      state.actorTool.clipboardActorId = payload;
    },
    setZoneShapeMode(state, { payload }: PayloadAction<ZoneShape>) {
      state.zoneShapeMode = payload;
      state.draft.polygonPointIds = [];
    },
    setEdgeDirectionality(state, { payload }: PayloadAction<EdgeDirectionality>) {
      state.edgeTool.directionality = payload;
    },
    setEdgeVisibilityRule(state, { payload }: PayloadAction<EdgeVisibilityRule>) {
      state.edgeTool.visibilityRule = payload;
    },
    setEdgeShape(state, { payload }: PayloadAction<EdgeShape>) {
      state.edgeTool.shape = payload;
    },
    toggleEdgeMovementRule(state, { payload }: PayloadAction<EdgeMovementRule>) {
      state.edgeTool.movementRules = state.edgeTool.movementRules.includes(payload)
        ? state.edgeTool.movementRules.filter((rule) => rule !== payload)
        : [...state.edgeTool.movementRules, payload];
    },
    resetEdgePreset(state) {
      state.edgeTool = DEFAULT_EDGE_PRESET;
    },
    setLastZoneOpacity(state, { payload }: PayloadAction<number>) {
      state.lastZoneOpacity = payload;
    },
    toggleZonePaintBrush(
      state,
      { payload }: PayloadAction<ZonePaintBrushState>
    ) {
      state.zonePaintBrush = state.zonePaintBrush ? null : payload;
    },
    clearZonePaintBrush(state) {
      state.zonePaintBrush = null;
    },
    toggleActorPaintBrush(state) {
      state.actorPaintBrush = !state.actorPaintBrush;
    },
    clearActorPaintBrush(state) {
      state.actorPaintBrush = false;
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
    setDragActionPreview(
      state,
      { payload }: PayloadAction<InteractionState['dragActionPreview']>
    ) {
      state.dragActionPreview = payload;
    },
    requestContextualAction(
      state,
      {
        payload
      }: PayloadAction<Pick<ContextualActionRequest, 'entityId' | 'entityType'>>
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
      { payload }: PayloadAction<BoxSelection['start']>
    ) {
      state.draft.boxSelection = {
        start: payload,
        current: payload
      };
    },
    updateBoxSelection(
      state,
      { payload }: PayloadAction<BoxSelection['current']>
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
      selectIds(
        state,
        payload.entityType,
        payload.ids,
        payload.additive ?? false
      );
      state.draft.boxSelection = null;
    },
    setPolygonDraftPointIds(state, { payload }: PayloadAction<string[]>) {
      state.draft.polygonPointIds = payload;
    },
    resetInteractionState() {
      return initialState;
    }
  }
});

export const {
  clearActorPaintBrush,
  setActorClipboardActor,
  setActorToolLayoutGroup,
  setActorToolShape,
  setActorToolSize,
  setActorToolTargetZone,
  clearZonePaintBrush,
  clearInteractionDraft,
  clearSelection,
  finishBoxSelection,
  requestContextualAction,
  resetInteractionState,
  selectEntity,
  setActiveTool,
  setTouchMultiSelect,
  setDragActionPreview,
  setEdgeDirectionality,
  setEdgeShape,
  setEdgeVisibilityRule,
  setLastZoneOpacity,
  setPolygonDraftPointIds,
  setZoneShapeMode,
  resetEdgePreset,
  toggleEdgeMovementRule,
  toggleZonePaintBrush,
  toggleActorPaintBrush,
  toggleTouchMultiSelect,
  startBoxSelection,
  updateBoxSelection
} = interactionSlice.actions;

export default interactionSlice.reducer;
