import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { gridToWorld } from '@core/movement/gridGeometry';
import type { GridConfiguration } from '@core/movement/types';
import { detectBackgroundGrid } from '@ui/canvas/grid/detectBackgroundGrid';

vi.mock('@ui/canvas/grid/detectBackgroundGrid', () => ({ detectBackgroundGrid: vi.fn() }));
function setup() {
  renderApp(); mockCanvasBounds(getCanvas());
  const state = createEncounterState({ id: 'alignment', name: 'Alignment' });
  state.grid = { ...state.grid, cellSize: 50, visible: true, origin: { x: 100, y: 100 } };
  act(() => store.dispatch(loadEncounterState(state)));
  return structuredClone(state);
}
describe('grid settings and alignment controls', () => {
  it.each(['Cancel', 'Escape', 'subtool'])('restores temporary max zoom on %s without encounter changes', async close => {
    const user = userEvent.setup(), state = setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    const waypoints = screen.getByRole('button', { name: 'Align grid to background' });
    await user.click(waypoints);
    const viewport = screen.getByLabelText('Canvas viewport');
    fireEvent.keyDown(window, { key: '+' });
    expect(viewport).toHaveAttribute('data-canvas-zoom', '1.1');
    await user.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
    expect(viewport).toHaveAttribute('data-canvas-zoom', '4');
    await user.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
    if (close === 'Escape') fireEvent.keyDown(window, { key: 'Escape' });
    else await user.click(close === 'subtool' ? waypoints : screen.getByRole('button', { name: 'Cancel' }));
    expect(viewport).toHaveAttribute('data-canvas-zoom', '1.1');
    expect(store.getState().encounter.present).toEqual(state);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it('keeps manually adjusted zoom after temporary max zoom', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    await user.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
    fireEvent.keyDown(window, { key: '-' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Canvas viewport')).toHaveAttribute('data-canvas-zoom', '3.9');
  });
  it('keeps a manual zoom command even when already at the maximum', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    await user.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
    fireEvent.keyDown(window, { key: '+' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Canvas viewport')).toHaveAttribute('data-canvas-zoom', '4');
  });
  it('toggles Waypoints off as a cancellation with no encounter mutation', async () => {
    const user = userEvent.setup(); const state = setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    const waypoints = screen.getByRole('button', { name: 'Align grid to background' });
    expect(waypoints).toHaveAttribute('aria-pressed', 'false');
    await user.click(waypoints);
    expect(waypoints).toHaveAttribute('aria-pressed', 'true'); expect(waypoints).toHaveAttribute('aria-expanded', 'true');
    for (const [clientX, clientY] of [[100, 100], [150, 100], [150, 150], [100, 150]]) fireEvent.click(getCanvas(), { clientX, clientY });
    expect(screen.getByRole('button', { name: 'Apply alignment' })).toBeEnabled();
    await user.click(waypoints);
    expect(waypoints).toHaveAttribute('aria-pressed', 'false'); expect(waypoints).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Grid alignment' })).not.toBeInTheDocument();
    expect(store.getState().interaction.gridCalibrationPoints).toEqual([]); expect(store.getState().interaction.gridPreview).toBeNull();
    expect(store.getState().encounter.present).toEqual(state); expect(store.getState().encounter.past).toHaveLength(0);
  });
  it('toggles the settings subtool and lists flat hex before pointy hex', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    const settings = screen.getByRole('button', { name: 'Grid settings' });
    expect(settings).toHaveAttribute('aria-pressed', 'false');
    await user.click(settings);
    expect(settings).toHaveAttribute('aria-pressed', 'true'); expect(settings).toHaveAttribute('aria-expanded', 'true');
    const select = screen.getByRole('combobox', { name: 'Grid type' });
    expect(within(select).getAllByRole('option').map(option => option.getAttribute('value'))).toEqual(['square', 'hex-flat', 'hex-pointy']);
    await user.click(settings);
    expect(settings).toHaveAttribute('aria-pressed', 'false'); expect(settings).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Grid settings' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    expect(within(screen.getByRole('group', { name: 'Alignment grid type' })).getAllByRole('button').map(button => button.textContent)).toEqual(['Square', 'Hex flat', 'Hex pointy']);
  });
  it('keeps zoom keybinds available from settings fields without editing the grid', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Grid settings' }));
    const viewport = screen.getByLabelText('Canvas viewport'), field = screen.getByRole('spinbutton', { name: 'Cell size' });
    Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: 480 });
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 400 });
    const history = store.getState().encounter.past.length;
    fireEvent.keyDown(field, { key: 'ArrowDown', ctrlKey: true }); expect(viewport).toHaveAttribute('data-canvas-zoom', '1');
    fireEvent.keyDown(field, { key: '+' }); expect(viewport).toHaveAttribute('data-canvas-zoom', '1.1');
    fireEvent.keyDown(field, { key: '-' }); expect(viewport).toHaveAttribute('data-canvas-zoom', '1');
    fireEvent.keyDown(field, { key: 'ArrowLeft', ctrlKey: true }); await waitFor(() => expect(viewport).toHaveAttribute('data-canvas-zoom', '0.5'));
    fireEvent.keyDown(field, { key: 'ArrowRight', ctrlKey: true }); await waitFor(() => expect(viewport).toHaveAttribute('data-canvas-zoom', '0.625'));
    fireEvent.keyDown(field, { key: 'ArrowUp', ctrlKey: true }); await waitFor(() => expect(viewport).toHaveAttribute('data-canvas-zoom', '0.5'));
    expect(field).toHaveValue(50); expect(store.getState().interaction.gridPreview!.cellSize).toBe(50);
    expect(store.getState().encounter.past).toHaveLength(history);
    expect(screen.getByRole('dialog', { name: 'Grid settings' })).toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'l' }); expect(screen.queryByRole('dialog', { name: 'Encounter Library' })).not.toBeInTheDocument();
  });
  it('chooses grid type before complexity and right-click removes the latest vertex', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    const types = within(screen.getByRole('group', { name: 'Alignment grid type' }));
    expect(types.getByRole('button', { name: 'Square' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(types.getByRole('button', { name: 'Hex pointy' }));
    expect(types.getByRole('button', { name: 'Hex pointy' })).toHaveAttribute('aria-pressed', 'true');
    expect(types.getByRole('button', { name: 'Square' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Four-quadrant alignment' }));
    expect(screen.getByRole('button', { name: 'Four-quadrant alignment' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(getCanvas(), { clientX: 100, clientY: 100 });
    fireEvent.click(getCanvas(), { clientX: 150, clientY: 100 });
    fireEvent.contextMenu(getCanvas()); expect(store.getState().interaction.gridCalibrationPoints).toEqual([{ x: 100, y: 100 }]);
    fireEvent.contextMenu(getCanvas()); fireEvent.contextMenu(getCanvas()); expect(store.getState().interaction.gridCalibrationPoints).toEqual([]);
    expect(store.getState().encounter.present.grid.type).toBe('square');
  });
  it('uses percentage opacity, a visibility switch, integer stepping, and rotation wrapping', async () => {
    const user = userEvent.setup(), state = setup();
    state.grid.cellSize = 50.4; state.grid.rotation = 89.4; state.grid.origin = { x: -2.4, y: 100.2 };
    act(() => store.dispatch(loadEncounterState({ ...state })));
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Grid settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Grid settings' }), controls = within(dialog);
    await user.click(controls.getByRole('button', { name: 'Increase Cell size' }));
    expect(controls.getByRole('spinbutton', { name: 'Cell size' })).toHaveValue(51);
    await user.click(controls.getByRole('button', { name: 'Increase Rotation (degrees)' }));
    expect(controls.getByRole('spinbutton', { name: 'Rotation (degrees)' })).toHaveValue(0);
    fireEvent.keyDown(controls.getByRole('spinbutton', { name: 'Origin X' }), { key: 'ArrowDown' });
    expect(controls.getByRole('spinbutton', { name: 'Origin X' })).toHaveValue(-3);
    fireEvent.keyDown(controls.getByRole('spinbutton', { name: 'Origin Y' }), { key: 'ArrowUp' });
    expect(controls.getByRole('spinbutton', { name: 'Origin Y' })).toHaveValue(101);
    fireEvent.change(controls.getByRole('slider', { name: 'Line opacity' }), { target: { value: '0.75' } });
    expect(controls.getByText('75%')).toBeInTheDocument();
    await user.click(controls.getByRole('switch', { name: 'Grid visible' }));
    expect(controls.getByRole('switch', { name: 'Grid visible' })).toHaveAttribute('aria-checked', 'false');
    expect(store.getState().interaction.gridPreview!.visible).toBe(false);
    await user.click(controls.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(store.getState().encounter.present.grid).toMatchObject({ cellSize: 51, rotation: 0, origin: { x: -3, y: 101 }, opacity: 0.75, visible: false }));
  });
  it('requires an explicit warp choice after four-quadrant sampling and preserves history', async () => {
    const user = userEvent.setup(), state = setup();
    const distorted: GridConfiguration = { ...state.grid, warp: { type: 'bilinear', x: [0, 1, 0, 0.006], y: [0, 0, 1, 0.004] } };
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    await user.click(screen.getByRole('button', { name: 'Four-quadrant alignment' }));
    const history = store.getState().encounter.past.length;
    for (const [x, y] of [[0, 0], [12, 0], [12, 8], [0, 8]]) {
      for (const [q, r] of [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]]) {
        const point = gridToWorld(distorted, { x: q * 50, y: r * 50 });
        fireEvent.click(getCanvas(), { clientX: point.x, clientY: point.y });
      }
    }
    expect(screen.getByRole('button', { name: 'Apply alignment' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Warp to image' }));
    expect(screen.getByLabelText('Warped grid overlay')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply alignment' }));
    await waitFor(() => expect(store.getState().encounter.present.grid.warp).toBeDefined());
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    const saved = store.getState().encounter.present;
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present).toEqual(state);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(saved);
  });
  it('offers detected square geometry as an uncommitted preview', async () => {
    const user = userEvent.setup(), state = setup();
    state.backgroundImage = { source: { kind: 'embedded', dataUrl: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }, name: 'Grid map', mediaType: 'image/svg+xml', width: 960, height: 640 };
    act(() => store.dispatch(loadEncounterState({ ...state })));
    vi.mocked(detectBackgroundGrid).mockResolvedValue({ ...state.grid, cellSize: 72, origin: { x: 12, y: 8 } });
    await user.click(screen.getByRole('button', { name: 'Background' }));
    await user.click(screen.getByRole('button', { name: 'Align grid to background' }));
    await user.click(screen.getByRole('button', { name: 'Temporary maximum zoom' }));
    await user.click(screen.getByRole('button', { name: 'Detect grid' }));
    expect(screen.getByLabelText('Canvas viewport')).toHaveAttribute('data-canvas-zoom', '4');
    await waitFor(() => expect(store.getState().interaction.gridPreview?.cellSize).toBe(72));
    expect(store.getState().encounter.present.grid.cellSize).toBe(50);
    await user.click(screen.getByRole('button', { name: 'Apply alignment' }));
    await waitFor(() => expect(store.getState().encounter.present.grid.cellSize).toBe(56.25));
    expect(screen.getByLabelText('Canvas viewport')).toHaveAttribute('data-canvas-zoom', '1');
  });
});
