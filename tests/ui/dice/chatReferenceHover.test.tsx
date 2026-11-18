import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { createZone } from "@entities/zone/zoneMutations";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { TARGET_PREVIEW_EVENT } from "@ui/dice/MentionSuggestions";
import { selectEntity, setActiveTool } from "@interaction/interactionState";

it('previews the saved actor identity after renaming and clears it on leave and unmount', () => {
  const state = diceEncounter();
  const references = snapshotReferences(state, '@Guard');
  state.actors.byId.b.name = 'Renamed';
  store.dispatch(loadEncounterState(state));
  const view = render(<Provider store={store}><ChatMessageText message="@Guard" references={references} /></Provider>);
  const listener = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, listener);
  try {
    fireEvent.mouseEnter(screen.getByText('@Guard'));
    expect(listener.mock.calls.at(-1)![0].detail).toEqual(['b']);
    fireEvent.mouseLeave(screen.getByText('@Guard'));
    expect(listener.mock.calls.at(-1)![0].detail).toEqual([]);
    fireEvent.mouseEnter(screen.getByText('@Guard'));
    view.unmount();
    expect(listener.mock.calls.at(-1)![0].detail).toEqual([]);
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }
});

it.each(['@Courtyard', '@Courtyard.enemies'])('previews only the matching zone members for %s', message => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  state.actors.byId.b.currentZoneId = 'z'; state.actors.byId.b.layoutGroup = 'enemy';
  state.actors.byId.c.currentZoneId = 'z'; state.actors.byId.c.layoutGroup = 'ally';
  store.dispatch(loadEncounterState(state));
  render(<Provider store={store}><ChatMessageText message={message} references={snapshotReferences(state, message)} /></Provider>);
  const listener = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, listener);
  try {
    fireEvent.mouseEnter(screen.getByText(message));
    expect(listener.mock.calls.at(-1)![0].detail).toEqual(message.includes('.') ? ['b'] : ['b', 'c']);
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }
});

it('keeps deleted references readable without previewing another actor with the same name', () => {
  const state = diceEncounter();
  const references = snapshotReferences(state, '@Guard');
  delete state.actors.byId.b; state.actors.allIds = state.actors.allIds.filter(id => id !== 'b');
  state.actors.byId.c.name = 'Guard';
  store.dispatch(loadEncounterState(state));
  render(<Provider store={store}><ChatMessageText message="@Guard" references={references} /></Provider>);
  const listener = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, listener);
  try {
    fireEvent.mouseEnter(screen.getByText('@Guard'));
    expect(listener).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '@Guard' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }
});

it.each(['select', 'actor', 'zone'] as const)('selects references from the %s tool without changing encounter history', tool => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  const message = '@Guard @Courtyard';
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool(tool));
  render(<Provider store={store}><ChatMessageText message={message} references={snapshotReferences(state, message)} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['b']);
  fireEvent.click(screen.getByRole('button', { name: '@Courtyard' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['z']);
  expect(store.getState().interaction.activeToolId).toBe('select');
  expect(store.getState().encounter.past).toHaveLength(0);
});

it('does not replace selection when clicking a deleted reference', () => {
  const state = diceEncounter(), references = snapshotReferences(state, '@Guard');
  delete state.actors.byId.b; state.actors.allIds = state.actors.allIds.filter(id => id !== 'b');
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('select'));
  store.dispatch(selectEntity({ entityType: 'actor', ids: ['c'] }));
  render(<Provider store={store}><ChatMessageText message="@Guard" references={references} /></Provider>);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  expect(store.getState().interaction.selection.selectedIds).toEqual(['c']);
});

it('switches deleted references to warning-only controls and restores navigation when entities return', () => {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [] });
  const message = '@Guard @Courtyard';
  store.dispatch(loadEncounterState(state));
  render(<Provider store={store}><ChatMessageText message={message} references={snapshotReferences(state, message)} /></Provider>);
  expect(screen.getByRole('button', { name: '@Guard' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '@Courtyard' })).toBeInTheDocument();
  const deleted = structuredClone(state);
  delete deleted.actors.byId.b; deleted.actors.allIds = deleted.actors.allIds.filter(id => id !== 'b');
  delete deleted.zones.byId.z; deleted.zones.allIds = [];
  act(() => { store.dispatch(loadEncounterState(deleted)); });
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  act(() => { store.dispatch(loadEncounterState(state)); });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '@Guard' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '@Courtyard' })).toBeInTheDocument();
});
