import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { expect, it } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setActiveTool, setAudioSectionType } from "@interaction/interactionState";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { scopedReferenceEncounter } from "@tests/core/dice/fixtures";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";

it.each(['select', 'zone', 'grid', 'ruler', 'edge', 'actor', 'annotation', 'background', 'audio'] as ToolId[])(
  'selects individual actors, scoped factions, direct factions, and Zones from the %s tool', tool => {
    const state = scopedReferenceEncounter(); store.dispatch(loadEncounterState(state));
    store.dispatch(setActiveTool(tool)); if (tool === 'audio') store.dispatch(setAudioSectionType('encounter'));
    const history = store.getState().encounter;
    const message = '@Guard @Zone1.heroes @heroes @Zone1';
    render(<Provider store={store}><ChatMessageText message={message} references={snapshotReferences(state, message)} /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
    expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: 'actor', selectedIds: ['b'] });
    expect(store.getState().interaction.activeToolId).toBe(['select', 'actor', 'grid', 'audio'].includes(tool) ? tool : 'select');
    if (tool === 'audio') expect(store.getState().interaction.audioTool.sectionType).toBe('actor');
    fireEvent.click(screen.getByRole('button', { name: '@Zone1.heroes' }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd']);
    fireEvent.click(screen.getByRole('button', { name: '@heroes' }));
    expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'c', 'd']);
    fireEvent.click(screen.getByRole('button', { name: '@Zone1' }));
    expect(store.getState().interaction.selection).toMatchObject({ selectedEntityType: 'zone', selectedIds: ['z1'] });
    expect(store.getState().interaction.activeToolId).toBe(tool === 'audio' ? 'audio' : 'select');
    if (tool === 'audio') expect(store.getState().interaction.audioTool.sectionType).toBe('zone');
    expect(store.getState().encounter).toBe(history);
  }
);
it('leaves the tool and selection unchanged when activating a stale reference', () => {
  const state = scopedReferenceEncounter(); const references = snapshotReferences(state, '@Guard');
  delete state.actors.byId.b; state.actors.allIds = state.actors.allIds.filter(id => id !== 'b');
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('background'));
  const before = store.getState().interaction;
  render(<Provider store={store}><ChatMessageText message="@Guard" references={references} /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  expect(store.getState().interaction).toBe(before);
});
