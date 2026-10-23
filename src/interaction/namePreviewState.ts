import type { PayloadAction } from '@reduxjs/toolkit';

export type NamePreview = { owner: string; encounterId: string; kind: 'actor' | 'zone' | 'ruler'; ids: string[]; name: string };
type State = { namePreview: NamePreview | null };

/** Names remain a single durable domain fact; uncommitted text is display-only presentation. */
export const namePreviewReducers = {
  setNamePreview(state: State, { payload }: PayloadAction<NamePreview>) { state.namePreview = payload; },
  clearNamePreview(state: State, { payload }: PayloadAction<string | undefined>) {
    if (!payload || state.namePreview?.owner === payload) state.namePreview = null;
  }
};
export function previewedName(preview: NamePreview | null, encounterId: string, kind: NamePreview['kind'], id: string, committed: string): string {
  return preview?.encounterId === encounterId && preview.kind === kind && preview.ids.includes(id) ? preview.name : committed;
}
