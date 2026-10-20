import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

describe('independent Zone/Grid toolbar rules', () => {
  afterEach(() => setPersistenceWritable(true));
  function setup() { renderApp(); act(() => { store.dispatch(loadEncounterState(createEncounterState({ id: 'rules', name: 'Rules' }))); store.dispatch(setActiveTool('grid')); }); }
  it('exposes separate tools and grouped controls without a cycle button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Zone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grid' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Movement strategy/ })).not.toBeInTheDocument();
    const snapping = within(screen.getByRole('group', { name: 'Grid visibility and snapping' }));
    expect(snapping.getByRole('button', { name: 'Snap Actors and Rulers to Grid' })).toHaveAttribute('title', 'Snap Actors and Rulers to Grid');
    expect(snapping.getByRole('button', { name: 'Snap Zone Vertices to Grid' })).toHaveAttribute('title', 'Snap Zone Vertices to Grid');
    expect(screen.getByRole('button', { name: 'Overlap' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    expect(screen.queryByRole('button', { name: 'Grid settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edge' })).toBeInTheDocument();
  });
  it('changes rules independently of the selected tool and restores them through history', async () => {
    setup();
    const initial = store.getState().encounter.present;
    fireEvent.click(screen.getByRole('button', { name: 'Snap Actors and Rulers to Grid' }));
    await waitFor(() => expect(store.getState().encounter.present.movementRules.snapToGrid).toBe(true));
    expect(store.getState().encounter.present.movementRules.zoneLocked).toBe(true);
    expect(store.getState().interaction.activeToolId).toBe('grid');
    const changed = store.getState().encounter.present;
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(initial);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(changed);
    fireEvent.click(screen.getByRole('button', { name: 'Zone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zone lock' }));
    await waitFor(() => expect(store.getState().encounter.present.movementRules.zoneLocked).toBe(false));
    expect(store.getState().interaction.activeToolId).toBe('zone');
  });
  it('requires Zone vertex snapping for Cell Tracer', async () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Zone' }));
    expect(screen.getByRole('button', { name: 'Cell Tracer' })).toBeDisabled();
    const options = screen.getByLabelText('Zone options');
    const lock = within(options).getByRole('group', { name: 'Zone placement rules' });
    const shapes = within(options).getByRole('radiogroup', { name: 'Zone shape options' });
    expect(lock.compareDocumentPosition(shapes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(lock).getAllByRole('button')).toHaveLength(1);
    expect([...shapes.querySelectorAll('button')].at(-1)?.getAttribute('aria-label')).toBe('Cell Tracer');

    expect(screen.getByRole('button', { name: 'Cell Tracer' })).toHaveAttribute('title', 'Cell Tracer');
    expect(screen.getByRole('button', { name: 'Zone lock' })).toHaveAttribute('title', 'Zone lock');
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snap Zone Vertices to Grid' }));
    await waitFor(() => expect(store.getState().encounter.present.movementRules.snapZoneVertices).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: 'Zone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cell Tracer' }));
    expect(store.getState().interaction.cellTracerActive).toBe(true);
  });
});
