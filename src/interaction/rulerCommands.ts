import { createAction, nanoid } from '@reduxjs/toolkit';
import type { RulerOptions, RulerShape } from '@core/measurement/types';
import type { LayoutPoint } from '@core/layout/types';

/** Commands are committed through the encounter boundary; drafts remain interaction reducers. */
export const lockRulerDraft = createAction('interaction/lockRulerDraft', (points?: LayoutPoint[]) => ({ payload: { id: nanoid(), points } }));
export const editLockedRuler = createAction<string>('interaction/editLockedRuler');
export const deleteLockedRuler = createAction<string>('interaction/deleteLockedRuler');
export const clearRulers = createAction('interaction/clearRulers');
export const updateLockedRuler = createAction<{ id: string; options?: RulerOptions; name?: string; color?: string | null; opacity?: number | null; historyGroupId?: string }>('interaction/updateLockedRuler');

export const convertLockedRuler = createAction<{ id: string; shape: RulerShape }>('interaction/convertLockedRuler');
