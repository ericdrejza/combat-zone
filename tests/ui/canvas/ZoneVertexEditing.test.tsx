import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createZone } from '@entities/zone/zoneMutations';
import { selectEntity, setActiveTool, setZoneShapeMode } from '@interaction/interactionState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { store } from '@store/store';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
import * as runtimeValidation from '@core/validation/runtimeEncounterChange';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';

const polygon = [{ x: 64, y: 64 }, { x: 256, y: 64 }, { x: 256, y: 256 }, { x: 64, y: 256 }];

function setup(shape: 'polygon' | 'rectangle' = 'polygon', points = polygon, snapping = false) {
  renderApp();
  let state = createEncounterState({ id: 'edit', name: 'Edit' });
  state.movementRules.snapZoneVertices = snapping;
  state = createZone(state, { id: 'z', name: 'Editable', shape, polygon: points });
  act(() => {
    store.dispatch(loadEncounterState(state));
    store.dispatch(setActiveTool('zone'));
  });
  const canvas = getCanvas();
  mockCanvasBounds(canvas);
  return { canvas, state };
}

it('adds a vertex at the double-click position, with undo and redo', async () => {
  const { canvas, state } = setup();
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 59 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  const edited = store.getState().encounter.present;
  expect(edited.zones.byId.z.polygon).toEqual([polygon[0], { x: 160, y: 59 }, ...polygon.slice(1)]);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(state);
  act(() => store.dispatch(redoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(edited);
});

it('removes a double-clicked vertex through the actual click sequence', async () => {
  const { state } = setup();
  await userEvent.setup().pointer({
    target: screen.getByLabelText('Editable'),
    keys: '[MouseLeft][MouseLeft]',
    coords: { clientX: 64, clientY: 64 }
  });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(1));
  expect(store.getState().encounter.present.zones.byId.z.polygon).toEqual(polygon.slice(1));
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(state);
});

it.each([1, 2])('uses screen distances for hit testing and spacing at scale %s', scale => {
  const { canvas } = setup();
  mockCanvasBounds(canvas, { width: 960 * scale, height: 640 * scale });
  fireEvent.doubleClick(canvas, { clientX: 64 * scale + 18, clientY: 64 * scale });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.doubleClick(canvas, { clientX: 160 * scale, clientY: 64 * scale - 13 });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.doubleClick(canvas, { clientX: 160 * scale, clientY: 64 * scale - 10 });
  expect(store.getState().encounter.past).toHaveLength(1);
});

it('snaps the inserted point before enforcing spacing', () => {
  const { canvas } = setup('polygon', polygon, true);
  fireEvent.doubleClick(canvas, { clientX: 89, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.doubleClick(canvas, { clientX: 133, clientY: 67 });
  expect(store.getState().encounter.present.zones.byId.z.polygon[1]).toEqual({ x: 128, y: 64 });
});

it('keeps at least three vertices and leaves generated shapes unchanged', () => {
  const { canvas } = setup('polygon', polygon.slice(0, 3));
  fireEvent.doubleClick(canvas, { clientX: 64, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(0);
  act(() => store.dispatch(loadEncounterState(createZone(store.getState().encounter.present, {
    id: 'z', name: 'Editable', shape: 'rectangle', polygon
  }))));
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(0);
  expect(store.getState().encounter.present.zones.byId.z.shape).toBe('rectangle');
});

it('does not edit vertices in the Actor tool', () => {
  const { canvas } = setup();
  act(() => store.dispatch(setActiveTool('actor')));
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(0);
});

it('rejects an inserted vertex that makes the Zone overlap a neighbor', () => {
  const { canvas, state } = setup();
  const withNeighbor = createZone(state, { id: 'neighbor', polygon: [
    { x: 144, y: 24 }, { x: 176, y: 24 }, { x: 176, y: 58 }, { x: 144, y: 58 }
  ] });
  act(() => store.dispatch(loadEncounterState(withNeighbor)));
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 54 });
  expect(store.getState().encounter.present).toEqual(withNeighbor);
  expect(store.getState().encounter.past).toHaveLength(0);
});

it.each(['STRICT', 'ADVISORY'] as const)('honors %s validation for edits', mode => {
  const { canvas, state } = setup();
  act(() => store.dispatch(loadEncounterState({ ...state, validationState: { ...state.validationState, mode } })));
  vi.spyOn(runtimeValidation, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input =>
    prepareValidatedEncounterChange({ ...input, validators: [{
      id: 'VertexEditConstraint', validate: () => ({ valid: false, messages: [{
        code: 'edit.constraint', severity: 'error', message: 'Constraint'
      }] })
    }] })
  );
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(mode === 'STRICT' ? 0 : 1);
});

it('hides the Zoneless panel during polygon and shape drafts and preserves its expansion', () => {
  const { canvas } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Expand zoneless actors' }));
  act(() => store.dispatch(setZoneShapeMode('polygon')));
  fireEvent.click(canvas, { clientX: 400, clientY: 400 });
  expect(screen.queryByRole('complementary', { name: 'Zoneless actors' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Collapse zoneless actors' })).toBeInTheDocument();
  act(() => store.dispatch(setZoneShapeMode('rectangle')));
  fireEvent.mouseDown(canvas, { button: 0, clientX: 400, clientY: 400 });
  expect(screen.queryByRole('complementary', { name: 'Zoneless actors' })).not.toBeInTheDocument();
  fireEvent.mouseMove(canvas, { clientX: 520, clientY: 520 });
  fireEvent.mouseUp(canvas);
  expect(screen.getByRole('button', { name: 'Collapse zoneless actors' })).toBeInTheDocument();
});

afterEach(() => vi.restoreAllMocks());

it('keeps the Zoneless panel mounted but noninteractive while resizing and moving a Zone', async () => {
  const { canvas } = setup();
  const panel = screen.getByRole('complementary', { name: 'Zoneless actors' });
  fireEvent.click(screen.getByRole('button', { name: 'Expand zoneless actors' }));
  act(() => store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] })));
  fireEvent.mouseDown(screen.getByLabelText('Editable vertex 2'), {
    button: 0, clientX: 256, clientY: 64
  });
  expect(panel).toBeInTheDocument();
  expect(panel).toHaveAttribute('aria-hidden', 'true');
  expect(panel).toHaveAttribute('inert');
  expect(screen.queryByRole('button', { name: 'Collapse zoneless actors' })).not.toBeInTheDocument();
  fireEvent.mouseMove(canvas, { clientX: 288, clientY: 64 });
  fireEvent.mouseUp(canvas);
  await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'false'));
  expect(panel).not.toHaveAttribute('inert');
  expect(screen.getByRole('button', { name: 'Collapse zoneless actors' })).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByLabelText('Editable'), { button: 0, clientX: 160, clientY: 160 });
  expect(panel).toHaveAttribute('aria-hidden', 'true');
  fireEvent.mouseMove(canvas, { clientX: 180, clientY: 180 });
  fireEvent.mouseUp(canvas);
  await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'false'));
  expect(screen.getByRole('complementary', { name: 'Zoneless actors' })).toBe(panel);
  expect(store.getState().encounter.past).toHaveLength(2);
});

it('enables double-click editing only after manual Polygon conversion', async () => {
  const { canvas, state } = setup('rectangle');
  act(() => store.dispatch(selectEntity({ entityType: 'zone', ids: ['z'] })));
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 64 });
  expect(store.getState().encounter.past).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Convert to polygon' }));
  await waitFor(() => expect(store.getState().encounter.present.zones.byId.z.shape).toBe('polygon'));
  expect(store.getState().encounter.present.zones.byId.z.polygon).toEqual(polygon);
  fireEvent.doubleClick(canvas, { clientX: 160, clientY: 64 });
  await waitFor(() => expect(store.getState().encounter.past).toHaveLength(2));
  expect(store.getState().encounter.present.zones.byId.z.polygon).toHaveLength(5);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present.zones.byId.z.shape).toBe('polygon');
  expect(store.getState().encounter.present.zones.byId.z.polygon).toEqual(polygon);
  act(() => store.dispatch(undoEncounterChange()));
  expect(store.getState().encounter.present).toEqual(state);
});
