import { interactionSlice, setNamePreview, clearNamePreview, setActiveTool, resetInteractionState } from '@interaction/interactionState';
import { previewedName, type NamePreview } from '@interaction/namePreviewState';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { loadEncounterState } from '@store/encounterSlice';

const preview: NamePreview = { owner: 'field', encounterId: 'e', kind: 'actor', ids: ['a', 'b'], name: 'Draft' };
const reducer = interactionSlice.reducer;
it('applies preview names only to the matching encounter, kind, and entity IDs', () => {
  for (const id of ['a', 'b']) expect(previewedName(preview, 'e', 'actor', id, 'Saved')).toBe('Draft');
  expect(previewedName(preview, 'other', 'actor', 'a', 'Saved')).toBe('Saved');
  expect(previewedName(preview, 'e', 'zone', 'a', 'Saved')).toBe('Saved');
  expect(previewedName(preview, 'e', 'actor', 'other', 'Saved')).toBe('Saved');
});
it('does not let stale editor cleanup clear another editor preview', () => {
  const state = reducer(undefined, setNamePreview(preview));
  expect(reducer(state, clearNamePreview('old-field')).namePreview).toEqual(preview);
  expect(reducer(state, clearNamePreview('field')).namePreview).toBeNull();
});
it('clears transient previews on tool changes, snapshot loads, and interaction reset', () => {
  const state = reducer(undefined, setNamePreview(preview));
  for (const action of [setActiveTool('select'), loadEncounterState(createEncounterState({ id: 'e', name: 'Reload' })), resetInteractionState()]) {
    expect(reducer(state, action).namePreview).toBeNull();
  }
});
