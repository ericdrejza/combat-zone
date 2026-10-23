import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { setActiveTool } from '@interaction/interactionState';
import { selectLockedRulers, selectRulerDraft } from '@interaction/rulerState';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { RulerSettings } from '@ui/settings/RulerSettings';
import { CANVAS_PREFERENCES_KEY, readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { LOCAL_PREFERENCES_RESET_EVENT } from '@ui/motion_preferences/MotionPreferenceProvider';
import type { Actor } from '@entities/actor/types';

const touchDescriptor = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');
function setup(touch = false) {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touch ? 1 : 0 });
  renderApp(); mockCanvasBounds(getCanvas()); act(() => store.dispatch(setActiveTool('ruler')));
}
const surface = () => screen.getByLabelText('Ruler drawing surface');
const place = (x: number, y: number) => fireEvent.pointerDown(surface(), { button: 0, pointerId: 1, clientX: x, clientY: y });
const lock = () => fireEvent.keyDown(window, { key: ' ', code: 'Space' });
const saved = () => selectLockedRulers(store.getState());
const open = () => fireEvent.contextMenu(document.querySelector('[data-ruler-id] > g')!, { clientX: 128, clientY: 128 });
afterEach(() => {
  if (touchDescriptor) Object.defineProperty(navigator, 'maxTouchPoints', touchDescriptor);
  else Reflect.deleteProperty(navigator, 'maxTouchPoints');
  setPersistenceWritable(true); vi.useRealTimers(); localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT));
});

it.each(['ADVISORY', 'STRICT'] as const)('saves radial display toggles independently per ruler with exact undo/redo in %s', mode => {
  setup();
  act(() => { const state = store.getState().encounter.present; store.dispatch(loadEncounterState({ ...state, validationState: { mode, messages: [] } })); });
  place(128, 128); place(256, 128); lock(); place(320, 320); place(448, 320); lock();
  const before = saved();
  expect(screen.queryByRole('button', { name: 'Show measurement' })).not.toBeInTheDocument();
  open();
  const distance = screen.getByRole('menuitemcheckbox', { name: 'Show measurement' });
  const glow = screen.getByRole('menuitemcheckbox', { name: 'Highlight overlapping actors' });
  expect(distance).toHaveAttribute('aria-checked', 'true'); expect(glow).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(distance); expect(screen.getAllByLabelText('Measurement result')).toHaveLength(1);
  fireEvent.click(glow); const after = saved();
  expect(after[0].options).toMatchObject({ showDistance: false, highlightActors: true }); expect(after[1]).toEqual(before[1]);
  expect(store.getState().encounter.past).toHaveLength(4);
  act(() => { store.dispatch(undoEncounterChange()); store.dispatch(undoEncounterChange()); }); expect(saved()).toEqual(before);
  act(() => { store.dispatch(redoEncounterChange()); store.dispatch(redoEncounterChange()); }); expect(saved()).toEqual(after);
});
it('blocks saved toggle commands at the writer boundary', () => {
  setup(); place(128, 128); place(256, 128); lock(); const before = saved(); open();
  act(() => setPersistenceWritable(false));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Show measurement' }));
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Highlight overlapping actors' }));
  expect(saved()).toEqual(before); expect(store.getState().encounter.past).toHaveLength(1);
});
it('updates AoE actor highlights live and stores the intensity slider without encounter history', () => {
  setup();
  const actor: Actor = { id: 'actor', name: 'Target', actorType: 'creature', layoutGroup: 'enemy', size: 'medium', shape: 'circle', currentZoneId: 'zoneless', statusEffects: [], metadata: {}, spatialPosition: { x: 224, y: 160 } };
  act(() => { const state = store.getState().encounter.present; store.dispatch(loadEncounterState({ ...state, movementRules: { ...state.movementRules, zoneLocked: false, snapToGrid: false }, actors: { allIds: [actor.id], byId: { [actor.id]: actor } } })); });
  fireEvent.click(screen.getByRole('button', { name: 'Circle ruler' }));
  place(128, 128);
  fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 160, clientY: 128 });
  expect(document.querySelector('[data-ruler-highlight-actor="actor"]')).toBeNull();
  fireEvent.pointerMove(surface(), { pointerId: 1, clientX: 256, clientY: 128 });
  expect(document.querySelector('[data-ruler-highlight-actor="actor"]')).toBeInTheDocument();
  place(256, 128); lock(); const before = store.getState().encounter.present;
  render(<RulerSettings />);
  const intensity = screen.getByRole('slider', { name: 'Actor highlight intensity for ruler AoE overlap' });
  expect(intensity).toHaveValue('50');
  fireEvent.change(intensity, { target: { value: '0' } });
  expect(document.querySelector('[data-ruler-highlight-actor="actor"]')).toBeNull();
  expect(readCanvasPreferences().rulerActorHighlightIntensity).toBe(0);
  fireEvent.change(intensity, { target: { value: '80' } });
  expect(document.querySelector('[data-ruler-highlight-actor="actor"]')).toBeInTheDocument();
  expect(readCanvasPreferences().rulerActorHighlightIntensity).toBe(0.8);
  expect(store.getState().encounter.present).toBe(before); expect(store.getState().encounter.past).toHaveLength(1);
  open(); expect(screen.getByRole('menuitemcheckbox', { name: 'Highlight overlapping actors' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Highlight overlapping actors' }));
  expect(document.querySelector('[data-ruler-highlight-actor="actor"]')).toBeNull();
});
it('removes one point on tap and all points on hold, with the next tap starting a fresh ruler', () => {
  setup(true); expect(screen.queryByRole('switch', { name: 'Touch multi-select' })).not.toBeInTheDocument();
  place(128, 128); place(256, 128); place(320, 256);
  fireEvent.click(screen.getByRole('button', { name: 'Remove last ruler point' }));
  expect(selectRulerDraft(store.getState())?.points).toHaveLength(2);
  vi.useFakeTimers(); const remove = screen.getByRole('button', { name: 'Remove last ruler point' });
  fireEvent.pointerDown(remove, { button: 0, pointerType: 'touch', pointerId: 2 });
  act(() => vi.advanceTimersByTime(510));
  fireEvent.pointerUp(remove, { button: 0, pointerType: 'touch', pointerId: 2 }); fireEvent.click(remove);
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(saved()).toEqual([]);
  place(400, 400); expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 400, y: 400 }]);
  expect(store.getState().encounter.past).toHaveLength(0);
});
it.each([false, true])('shows touch-hold hints only on touch-capable screens (%s)', touch => {
  setup(touch); place(128, 128); place(256, 128); lock();
  expect(screen.queryAllByText(/touch-hold/).length > 0).toBe(touch);
  expect(screen.queryByRole('button', { name: 'Remove last ruler point' })).not.toBeInTheDocument();
  place(320, 320); expect(!!screen.queryByRole('button', { name: 'Remove last ruler point' })).toBe(touch);
});
it('clears all points during an existing touch edit without deleting the saved artifact or adding history', () => {
  setup(true); place(128, 128); place(256, 128); lock(); const original = saved(); open();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit ruler' })); place(320, 256);
  vi.useFakeTimers(); const remove = screen.getByRole('button', { name: 'Remove last ruler point' });
  fireEvent.pointerDown(remove, { button: 0, pointerType: 'touch', pointerId: 2 });
  act(() => vi.advanceTimersByTime(510));
  expect(selectRulerDraft(store.getState())).toBeNull(); expect(saved()).toEqual(original);
  expect(store.getState().encounter.past).toHaveLength(1);
  place(400, 400); expect(selectRulerDraft(store.getState())?.points).toEqual([{ x: 400, y: 400 }]);
});
