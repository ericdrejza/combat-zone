import { selectLockedRulers } from '@interaction/rulerState';
import { TOUCH_NAVIGATION_START_EVENT } from '@ui/canvas/useCanvasTouchGestures';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';

function setup() {
  renderApp(); const before = createEncounterState({ id: 'ruler', name: 'Ruler' });
  before.movementRules.snapToGrid = true;
  act(() => { store.dispatch(loadEncounterState(before)); store.dispatch(setActiveTool('ruler')); });
  mockCanvasBounds(getCanvas()); return before;
}
const surface = () => screen.getByLabelText('Ruler drawing surface');
const click = (x: number, y: number) => fireEvent.pointerDown(surface(), { button: 0, clientX: x, clientY: y, pointerId: 1 });
const draw = () => { click(128, 128); click(256, 256); };
const lock = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
afterEach(() => setPersistenceWritable(true));

describe('session ruler interactions', () => {
  it('uses clicks instead of drags and automatically highlights snapped cells', () => {
    const before = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Circle ruler' }));
    click(128, 128);
    fireEvent.pointerMove(surface(), { clientX: 256, clientY: 128, pointerId: 1 });
    fireEvent.pointerUp(surface(), { clientX: 256, clientY: 128, pointerId: 1 });
    expect(store.getState().interaction.rulerDraft?.complete).toBe(false);
    click(256, 128);
    expect(store.getState().interaction.rulerDraft?.complete).toBe(true);
    const points = store.getState().interaction.rulerDraft?.points;
    expect(screen.queryByRole('button', { name: /Highlight/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ruler measurement').querySelectorAll('polygon').length).toBeGreaterThan(0);
    expect(store.getState().interaction.rulerDraft?.points).toEqual(points);
    expect(screen.getByLabelText('Measurement result')).toHaveTextContent(/ft/);
    expect(store.getState().encounter.present).toEqual(before);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it('keeps multiple Space-locked paths through tool changes and supports editing more waypoints', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Path ruler' }));
    draw(); lock(); draw(); lock();
    expect(selectLockedRulers(store.getState())).toHaveLength(2);
    act(() => store.dispatch(setActiveTool('select')));
    expect(screen.getByLabelText('Ruler measurement')).toBeInTheDocument();
    act(() => store.dispatch(setActiveTool('ruler')));
    const artifact = document.querySelector('[data-ruler-id] > g')!;
    fireEvent.contextMenu(artifact, { clientX: 140, clientY: 140 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
    click(320, 256); lock();
    expect(selectLockedRulers(store.getState())[0].points).toHaveLength(3);
    expect(store.getState().interaction.editingRuler).toBeNull();
  });
  it('removes clicked points and cancels unfinished rulers on empty right-click or Escape', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Path ruler' }));
    draw();
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Ruler point 2' }));
    expect(store.getState().interaction.rulerDraft?.points).toHaveLength(1);
    fireEvent.contextMenu(surface()); expect(store.getState().interaction.rulerDraft).toBeNull();
    draw(); fireEvent.keyDown(window, { key: 'Escape' }); expect(store.getState().interaction.rulerDraft).toBeNull();
    draw(); act(() => window.dispatchEvent(new Event(TOUCH_NAVIGATION_START_EVENT)));
    expect(store.getState().interaction.rulerDraft).toBeNull();
  });
  it('permits read-only measurements and uses actor snapping without a separate Snap control', () => {
    const before = setup(); act(() => setPersistenceWritable(false));
    fireEvent.click(screen.getByRole('button', { name: 'Circle ruler' }));
    click(130, 130); click(210, 130);
    expect(screen.queryByRole('spinbutton', { name: 'Ruler range' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Measurement result')).toHaveTextContent('r 5 ft');
    expect(screen.queryByRole('button', { name: 'Snap ruler to grid' })).not.toBeInTheDocument();
    expect(store.getState().encounter.present).toEqual(before);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it('allows area point adjustment and locking again', () => {
    setup(); fireEvent.click(screen.getByRole('button', { name: 'Rectangle ruler' })); draw(); lock();
    fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 140, clientY: 140 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' }));
    const point = screen.getByRole('button', { name: 'Ruler point 2' });
    fireEvent.pointerDown(point, { button: 0, pointerId: 2, clientX: Number(point.getAttribute('cx')), clientY: Number(point.getAttribute('cy')) });
    fireEvent.pointerMove(point, { clientX: 320, clientY: 320, pointerId: 2 });
    fireEvent.pointerUp(point, { pointerId: 2, clientX: 320, clientY: 320 }); lock();
    expect(selectLockedRulers(store.getState())[0].points[1]).toEqual({ x: 320, y: 320 });
  });
});

it('supports contextual locking and per-artifact names, colors and deletion', () => {
  const before = setup(); draw();
  fireEvent.click(screen.getByRole('button', { name: 'Lock ruler' }));
  const open = () => fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 200, clientY: 200 });
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Name ruler' }));
  fireEvent.change(within(screen.getByRole('dialog', { name: 'Name ruler' })).getByRole('textbox', { name: 'Ruler name' }), { target: { value: 'Blast' } });
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
  expect(selectLockedRulers(store.getState())[0].name).toBe('Blast');
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Choose ruler color' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Artifact color hex color' }), { target: { value: '#ff000080' } });
  fireEvent.blur(screen.getByRole('textbox', { name: 'Artifact color hex color' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(selectLockedRulers(store.getState())[0]).toMatchObject({ color: '#ff0000', opacity: 128 / 255 });
  open(); fireEvent.click(screen.getByRole('menuitem', { name: 'Delete ruler' }));
  expect(selectLockedRulers(store.getState())).toHaveLength(0);
  expect(store.getState().encounter.present).toEqual(before);
});

it('switches grouped shape icons without manual cone-origin choices', () => {
  setup();
  for (const shape of ['Path', 'Circle', 'Cone', 'Rectangle', 'Line']) {
    const button = screen.getByRole('button', { name: `${shape} ruler` });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(store.getState().interaction.rulerOptions.shape).toBe(shape.toLowerCase());
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cone ruler' }));
  expect(screen.queryByRole('group', { name: 'Cone origin' })).not.toBeInTheDocument();
});
