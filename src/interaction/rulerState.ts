import { createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { InteractionState } from './interactionState';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { LockedRuler, RulerDraft, RulerOptions } from '@core/measurement/types';

type State = Pick<InteractionState, 'rulerOptions' | 'rulerDraft' | 'editingRuler'>;
export function activeRuler(state: { interaction: State }): LockedRuler | undefined { return state.interaction.editingRuler ?? undefined; }
export function selectRulerOptions(state: { interaction: State }): RulerOptions { return activeRuler(state)?.options ?? state.interaction.rulerOptions; }
export const selectLockedRulers = createSelector([(state: { encounter: { present: EncounterState } }) => state.encounter.present.rulers], rulers => rulers.allIds.map(id => rulers.byId[id]));
export const selectRulerDraft = createSelector(
  [activeRuler, (state: { interaction: State }) => state.interaction.rulerDraft],
  (ruler, draft): RulerDraft | null => ruler ? { points: ruler.points, complete: ruler.options.shape !== 'path' && ruler.points.length >= 2 } : draft
);
const editablePoints = (state: InteractionState, id: string | null) => id
  ? state.editingRuler?.id === id ? state.editingRuler.points : undefined : state.rulerDraft?.points;

/** Pending edits are independent of the saved version until Space commits one history action. */
export const rulerReducers = {
  setRulerOptions(state: InteractionState, { payload }: PayloadAction<Partial<RulerOptions>>) {
    if (state.editingRuler) state.editingRuler.options = { ...state.editingRuler.options, ...payload };
    else {
      if (payload.shape && payload.shape !== state.rulerOptions.shape) state.rulerDraft = null;
      state.rulerOptions = { ...state.rulerOptions, ...payload };
    }
  },
  setRulerDraft(state: InteractionState, { payload }: PayloadAction<RulerDraft | null>) {
    if (state.editingRuler && payload) state.editingRuler.points = payload.points;
    else { state.rulerDraft = payload; if (!payload) state.editingRuler = null; }
  },
  startRulerDraft(state: InteractionState, { payload }: PayloadAction<RulerDraft>) { state.editingRuler = null; state.rulerDraft = payload; },
  setEditingRuler(state: InteractionState, { payload }: PayloadAction<LockedRuler | null>) {
    state.editingRuler = payload ? { ...payload, options: { ...payload.options }, points: payload.points.map(point => ({ ...point })) } : null;
    if (payload) state.rulerDraft = null;
  },
  updateRulerPoint(state: InteractionState, { payload }: PayloadAction<{ id: string | null; index: number; point: LayoutPoint }>) {
    const points = editablePoints(state, payload.id); if (points?.[payload.index]) points[payload.index] = payload.point;
  },
  removeRulerPoint(state: InteractionState, { payload }: PayloadAction<{ id: string | null; index: number }>) {
    const points = editablePoints(state, payload.id);
    if (!points) return; points.splice(payload.index, 1);
    if (!payload.id && state.rulerDraft && points.length < 2) state.rulerDraft.complete = false;
    if (!points.length) { if (payload.id) state.editingRuler = null; else state.rulerDraft = null; }
  }
};
