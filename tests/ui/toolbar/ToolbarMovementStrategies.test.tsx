import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { undoEncounterChange, redoEncounterChange, loadEncounterState } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { createActor } from '@entities/actor/actorMutations';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

const cycle = () => screen.getByRole('button', { name: /Movement strategy:/ });

describe('movement strategy toolbar and grid controls', () => {
  afterEach(() => setPersistenceWritable(true));
  it('cycles the primary slot and suspends hidden editing workflows, with undo/redo', async () => {
    const user = userEvent.setup(); renderApp();
    await user.click(cycle());
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Edge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Zone shape options' })).not.toBeInTheDocument();
    act(() => store.dispatch(setActiveTool('edge'))); expect(store.getState().interaction.activeToolId).toBe('grid');
    fireEvent.keyDown(window, { key: 'e' }); expect(store.getState().interaction.activeToolId).toBe('grid');
    await user.click(cycle()); expect(screen.getByRole('button', { name: 'Free' })).toBeInTheDocument();
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.movementStrategy).toBe('grid');
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().interaction.activeToolId).toBe('free');
    await user.click(cycle()); expect(screen.getByRole('button', { name: 'Edge' })).toBeInTheDocument();
  });
  it('exposes Background grid controls in every strategy and saves manual hex settings', async () => {
    const user = userEvent.setup(); renderApp();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Grid settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Grid settings' });
    await user.selectOptions(within(dialog).getByLabelText('Grid type'), 'hex-pointy');
    fireEvent.change(within(dialog).getByLabelText('Cell size'), { target: { value: '50' } });
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().encounter.present.grid).toMatchObject({ type: 'hex-pointy', cellSize: 50 }));
    act(() => store.dispatch(setActiveTool('zone'))); await user.click(cycle());
    await user.click(screen.getByRole('button', { name: 'Background' }));
    expect(screen.getByRole('button', { name: 'Grid settings' })).toBeInTheDocument();
    act(() => store.dispatch(setActiveTool('grid'))); await user.click(cycle());
    await user.click(screen.getByRole('button', { name: 'Background' }));
    expect(screen.getByRole('button', { name: 'Grid settings' })).toBeInTheDocument();
  });
  it('calibrates from four square corners with one commit and supports cancellation', async () => {
    const user = userEvent.setup(); renderApp(); mockCanvasBounds(getCanvas());
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    const history = store.getState().encounter.past.length;
    for (const [clientX, clientY] of [[100, 100], [150, 100], [150, 150], [100, 150]]) fireEvent.click(getCanvas(), { clientX, clientY });
    expect(store.getState().encounter.past).toHaveLength(history);
    await user.click(screen.getByRole('button', { name: 'Apply alignment' }));
    await waitFor(() => expect(store.getState().encounter.present.grid.cellSize).toBeCloseTo(50));
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.grid.cellSize).toBe(64);
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    fireEvent.keyDown(window, { key: 'Escape' }); expect(store.getState().interaction.gridCalibrationActive).toBe(false);
  });
  it('places unassigned actors spatially and moves them by keyboard with hidden lines', async () => {
    const user = userEvent.setup(); renderApp(); await user.click(cycle());
    const state = createActor(store.getState().encounter.present, { id: 'spatial', currentZoneId: 'zoneless', name: 'Spatial' });
    state.actors.byId.spatial.spatialPosition = { x: 160, y: 160 };
    act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('actor')); });
    fireEvent.click(screen.getByLabelText('Spatial', { selector: 'g' }));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.spatial.spatialPosition).toEqual({ x: 224, y: 160 }));
    act(() => store.dispatch(setActiveTool('grid')));
    await user.click(screen.getByRole('button', { name: 'Hide grid' }));
    expect(store.getState().encounter.present.grid.visible).toBe(false);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(store.getState().encounter.present.actors.byId.spatial.spatialPosition).toEqual({ x: 288, y: 160 }));
  });
});
