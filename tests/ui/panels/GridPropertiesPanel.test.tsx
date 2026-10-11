import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool, startGridCalibration } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
function setup() {
  renderApp();
  const state = createEncounterState({ id: 'properties-grid', name: 'Grid' });
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('grid')); });
  return state;
}
describe('Grid Properties appearance drafts', () => {
  afterEach(() => setPersistenceWritable(true));
  it('previews colors without history until focus leaves the picker, then supports undo/redo', async () => {
    const initial = setup();
    expect(screen.queryByLabelText('Cell size')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
    const field = screen.getByLabelText('Grid line color');
    fireEvent.change(field, { target: { value: '#ff0000' } });
    await waitFor(() => expect(store.getState().interaction.gridAppearancePreview?.color).toBe('#ff0000'));
    expect(store.getState().encounter.present).toEqual(initial);
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.blur(field, { relatedTarget: screen.getByLabelText('Line opacity') });
    await waitFor(() => expect(store.getState().encounter.present.grid.color).toBe('#ff0000'));
    expect(store.getState().interaction.gridAppearancePreview).toBeNull();
    expect(store.getState().encounter.past).toHaveLength(1);
    const saved = store.getState().encounter.present;
    expect(saved.canvasSize).toEqual(initial.canvasSize);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(initial);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(saved);
  });
  it('closes the color picker on a second click and commits only once', async () => {
    setup(); const user = userEvent.setup();
    const opener = screen.getByLabelText('Grid line color');
    await user.click(opener);
    fireEvent.change(screen.getByLabelText('Grid line color'), { target: { value: '#aa0000' } });
    await user.click(opener);
    expect(opener).not.toHaveFocus();
    expect(opener).toHaveAttribute('type', 'color');
    await waitFor(() => expect(store.getState().encounter.present.grid.color).toBe('#aa0000'));
    expect(store.getState().encounter.past).toHaveLength(1);
  });
  it('previews rapid opacity changes and commits one history entry on blur', async () => {
    const initial = setup(), field = screen.getByLabelText('Line opacity');
    for (const value of ['0.1', '0.2', '0.4', '0.6']) fireEvent.change(field, { target: { value } });
    await waitFor(() => expect(store.getState().interaction.gridAppearancePreview?.opacity).toBe(0.6));
    expect(store.getState().encounter.present).toEqual(initial);
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.pointerUp(field);
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.blur(field);
    await waitFor(() => expect(store.getState().encounter.present.grid.opacity).toBe(0.6));
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(initial);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.grid.opacity).toBe(0.6);
  });
  it('serializes final color and opacity edits without losing either field', async () => {
    setup();
    const color = screen.getByLabelText('Grid line color');
    fireEvent.change(color, { target: { value: '#ff0000' } });
    fireEvent.blur(color);
    const opacity = screen.getByLabelText('Line opacity');
    fireEvent.change(opacity, { target: { value: '0.2' } }); fireEvent.blur(opacity);
    await waitFor(() => expect(store.getState().encounter.present.grid).toMatchObject({ color: '#ff0000', opacity: 0.2 }));
    expect(store.getState().encounter.past).toHaveLength(2);
  });
  it('commits a blurred appearance field when switching tools', async () => {
    setup(); const user = userEvent.setup();
    await user.click(screen.getByLabelText('Line opacity'));
    fireEvent.change(screen.getByLabelText('Line opacity'), { target: { value: '0.2' } });
    await user.click(screen.getByRole('button', { name: 'Zone' }));
    await waitFor(() => expect(store.getState().encounter.present.grid.opacity).toBe(0.2));
    expect(store.getState().interaction.gridAppearancePreview).toBeNull();
  });
  it('changes geometry immediately and yields to alignment', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Grid type'), { target: { value: 'hex-flat' } });
    await waitFor(() => expect(store.getState().encounter.present.grid.type).toBe('hex-flat'));
    act(() => store.dispatch(startGridCalibration('hex-flat')));
    expect(screen.getByLabelText('Grid type')).toBeDisabled();
    expect(store.getState().interaction.gridAppearancePreview).toBeNull();
  });
  it('enforces the writer boundary for preview and commit', async () => {
    const initial = setup();
    act(() => setPersistenceWritable(false));
    fireEvent.change(screen.getByLabelText('Line opacity'), { target: { value: '0.2' } });
    fireEvent.blur(screen.getByLabelText('Line opacity'));
    await act(async () => {});
    expect(store.getState().encounter.present).toEqual(initial);
  });
});
