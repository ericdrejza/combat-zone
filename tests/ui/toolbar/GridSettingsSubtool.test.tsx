import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

it.each([false, true])('includes functional Grid settings in its subtool group (compact=%s)', async compact => {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: query.includes('width <') && compact, media: query,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
  const app = renderApp();
  try {
    const state = createEncounterState({ id: 'settings-group', name: 'Settings' }); state.movementStrategy = 'grid'; state.grid.visible = true;
    act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('grid')); });
    const group = within(screen.getByRole('group', { name: 'Grid controls' }));
    expect(group.getByRole('button', { name: 'Hide grid' })).toBeInTheDocument();
    expect(group.getByRole('button', { name: 'Align grid to background' })).toBeInTheDocument();
    fireEvent.click(group.getByRole('button', { name: 'Grid settings' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Grid settings' }));
    fireEvent.change(dialog.getByRole('spinbutton', { name: 'Cell size' }), { target: { value: '32' } });
    expect(store.getState().encounter.present).toEqual(state);
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().encounter.past).toHaveLength(0);
    expect(store.getState().interaction.gridPreview).toBeNull();
    fireEvent.click(group.getByRole('button', { name: 'Grid settings' }));
    const applied = within(screen.getByRole('dialog', { name: 'Grid settings' }));
    fireEvent.change(applied.getByRole('spinbutton', { name: 'Cell size' }), { target: { value: '32' } });
    fireEvent.click(applied.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().encounter.present.grid.cellSize).toBe(32));
    const saved = store.getState().encounter.present;
    expect(getGridCoverage(saved)).toMatchObject({ width: 1920, height: 1280 });
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(saved);
    act(() => store.dispatch(setActiveTool('background')));
    expect(within(screen.getByRole('group', { name: 'Grid controls' })).getByRole('button', { name: 'Grid settings' })).toBeInTheDocument();
    act(() => setPersistenceWritable(false));
    fireEvent.click(screen.getByRole('button', { name: 'Grid settings' }));
    const guarded = screen.queryByRole('dialog', { name: 'Grid settings' });
    if (guarded) fireEvent.click(within(guarded).getByRole('button', { name: 'Apply' }));
    expect(store.getState().encounter.present).toEqual(saved);
  } finally { setPersistenceWritable(true); app.unmount(); window.matchMedia = original; }
});
