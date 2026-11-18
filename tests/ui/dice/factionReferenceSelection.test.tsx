import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setActiveTool } from "@interaction/interactionState";
import { scopedReferenceEncounter } from "@tests/core/dice/fixtures";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { TARGET_PREVIEW_EVENT } from "@ui/dice/MentionSuggestions";
import { createActor } from "@entities/actor/actorMutations";
import { revealZonelessActor } from "@ui/panels/zoneless_actors/zonelessActorReveal";
vi.mock('@ui/panels/zoneless_actors/zonelessActorReveal', async importOriginal => ({ ...await importOriginal<typeof import('@ui/panels/zoneless_actors/zonelessActorReveal')>(), revealZonelessActor: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
function setup(message: string, zoneless = false, tool: 'select' | 'zone' = 'select') {
  let state = scopedReferenceEncounter();
  if (zoneless) { state = createActor(state, { id: 'e', name: 'Unplaced Hero', currentZoneId: 'zoneless' }); state.actors.byId.e.layoutGroup = 'hero'; }
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool(tool));
  render(<Provider store={store}><ChatMessageText message={message} references={snapshotReferences(state, message)} /></Provider>);
  return store.getState().encounter;
}
it('selects only the actors of a Zone faction instead of selecting its Zone', () => {
  const before = setup('@Zone1.heroes');
  const listener = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, listener);
  try {
    const faction = screen.getByRole('button', { name: '@Zone1.heroes' });
    fireEvent.mouseEnter(faction); expect(listener.mock.calls.at(-1)![0].detail).toEqual(['a', 'd']);
    fireEvent.click(faction);
    expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: 'actor', selectedIds: ['a', 'd'] });
    expect(store.getState().encounter).toBe(before);
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }
});
it('selects the matching actors for each faction in a scoped list', () => {
  setup('@Zone1.[heroes,enemies]');
  fireEvent.click(screen.getByRole('button', { name: 'heroes' })); expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd']);
  fireEvent.click(screen.getByRole('button', { name: 'enemies' })); expect(store.getState().interaction.selection.selectedIds).toEqual(['b']);
});
it('selects a directly referenced faction on click and reveals Zoneless members on double-click', () => {
  setup('@heroes', true);
  fireEvent.click(screen.getByRole('button', { name: '@heroes' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'c', 'd', 'e']);
  expect(revealZonelessActor).not.toHaveBeenCalled();
  fireEvent.doubleClick(screen.getByRole('button', { name: '@heroes' }));
  expect(revealZonelessActor).toHaveBeenCalledWith('e', store.getState().encounterLog.encounterSession);
});
it('switches to Select and selects faction actors from the Zone tool', () => {
  setup('@Zone1.heroes', false, 'zone');
  fireEvent.click(screen.getByRole('button', { name: '@Zone1.heroes' }));
  expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: 'actor', selectedIds: ['a', 'd'] });
  expect(store.getState().interaction.activeToolId).toBe('select');
});
