import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { cancelGridEditing, setActiveTool, setGridPreview, startGridCalibration } from '@interaction/interactionState';
import * as validationRuntime from '@core/validation/validatedEncounterChange';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function setup() {
  renderApp();
  const state = createEncounterState({ id: 'properties-grid', name: 'Grid' }); state.movementStrategy = 'grid';
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('grid')); });
  return state;
}
describe('Grid tool Properties', () => {
  beforeEach(() => setPersistenceWritable(true));
  afterEach(() => setPersistenceWritable(true));
  it('discards pending validation after switching tools', async () => {
    let resolve!: (value: validationRuntime.PreparedValidatedEncounterChange) => void;
    let input!: validationRuntime.PrepareValidatedEncounterChangeInput;
    const spy = vi.spyOn(validationRuntime, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(request => {
      input = request; return new Promise(done => { resolve = done; });
    });
    try {
      const initial = setup();
      fireEvent.change(screen.getByLabelText('Cell size'), { target: { value: '80' } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      act(() => store.dispatch(setActiveTool('actor')));
      await act(async () => resolve(validationRuntime.prepareValidatedEncounterChange(input)));
      expect(store.getState().encounter.present).toEqual(initial);
      expect(store.getState().encounter.past).toHaveLength(0);
      expect(store.getState().interaction.gridPreview).toBeNull();
    } finally { spy.mockRestore(); }
  });
  it('previews, cancels, and commits shared grid controls with undo/redo', async () => {
    const initial = setup(), form = within(screen.getByRole('form', { name: 'Grid properties' }));
    expect(screen.queryByRole('dialog', { name: 'Grid settings' })).not.toBeInTheDocument();
    fireEvent.change(form.getByLabelText('Cell size'), { target: { value: '80' } });
    expect(store.getState().interaction.gridPreview!.cellSize).toBe(80);
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.click(form.getByRole('button', { name: 'Cancel' }));
    expect(form.getByLabelText('Cell size')).toHaveValue(64);
    fireEvent.change(form.getByLabelText('Grid type'), { target: { value: 'hex-flat' } });
    fireEvent.change(form.getByLabelText('Cell size'), { target: { value: '80' } });
    fireEvent.click(form.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().encounter.present.grid).toMatchObject({ type: 'hex-flat', cellSize: 80 }));
    const saved = store.getState().encounter.present;
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(initial);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(saved);
  });
  it('yields its preview to Waypoints and clears drafts when leaving the tool', () => {
    const initial = setup();
    fireEvent.change(screen.getByLabelText('Cell size'), { target: { value: '80' } });
    act(() => store.dispatch(startGridCalibration('square')));
    const calibration = { ...initial.grid, cellSize: 72 };
    act(() => store.dispatch(setGridPreview(calibration)));
    expect(screen.getByLabelText('Cell size')).toBeDisabled();
    expect(store.getState().interaction.gridPreview).toEqual(calibration);
    act(() => store.dispatch(cancelGridEditing()));
    expect(store.getState().interaction.gridPreview!.cellSize).toBe(80);
    act(() => store.dispatch(setActiveTool('actor')));
    expect(store.getState().interaction.gridPreview).toBeNull();
    expect(store.getState().encounter.present).toEqual(initial);
  });
});
