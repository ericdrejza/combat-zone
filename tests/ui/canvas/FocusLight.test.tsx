import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, getCanvas, mockCanvasBounds } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { loadEncounterState } from '@store/encounterSlice';
import { setActiveTool } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { CANVAS_PREFERENCES_KEY, DEFAULT_CANVAS_PREFERENCES, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { KEYBIND_STORAGE_KEY } from '@ui/keybinds';

afterEach(() => {
  setPersistenceWritable(true);
  localStorage.removeItem(CANVAS_PREFERENCES_KEY);
  localStorage.removeItem(KEYBIND_STORAGE_KEY);
  vi.restoreAllMocks();
  document.querySelectorAll('iframe').forEach(frame => frame.remove());
});

function setup() {
  renderApp();
  act(() => {
    store.dispatch(loadEncounterState({ ...store.getState().encounter.present, canvasSize: { width: 1000, height: 500 } }));
    store.dispatch(setActiveTool('zone'));
  });
  const canvas = getCanvas();
  mockCanvasBounds(canvas, { width: 1000, height: 500 });
  fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
  return canvas;
}

it('holds F without repeats, blocks editing and releases even when focus or modifiers change', async () => {
  const canvas = setup(), history = store.getState().encounter;
  fireEvent.keyDown(window, { key: 'f', code: 'KeyF' });
  const light = await screen.findByRole('img', { name: 'Focus light' });
  expect(light.querySelector('circle')).toHaveAttribute('cx', '300');
  expect(light.querySelector('circle')).toHaveAttribute('cy', '200');
  fireEvent.keyDown(window, { key: 'f', code: 'KeyF', repeat: true });
  fireEvent.mouseDown(canvas, { button: 0, buttons: 1, clientX: 100, clientY: 100 });
  fireEvent.mouseMove(canvas, { buttons: 1, clientX: 300, clientY: 300 });
  fireEvent.keyDown(window, { key: 'Delete' });
  fireEvent.keyDown(window, { key: 'a' });
  expect(store.getState().interaction.activeToolId).toBe('zone');
  fireEvent.keyUp(window, { key: 'F', code: 'KeyF', shiftKey: true });
  fireEvent.mouseUp(canvas, { button: 0, clientX: 300, clientY: 300 });
  fireEvent.click(canvas, { button: 0, clientX: 300, clientY: 300 });
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  expect(store.getState().encounter).toBe(history);
  fireEvent.keyDown(window, { key: 'a' });
  expect(store.getState().interaction.activeToolId).toBe('actor');
});

it('toggles until the next press, Escape, or window blur and suppresses repeat toggles', async () => {
  saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, focus: { ...DEFAULT_CANVAS_PREFERENCES.focus, activation: 'toggle' } });
  const canvas = setup();
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.keyUp(window, { key: 'f' });
  fireEvent.keyDown(window, { key: 'f', repeat: true });
  expect(screen.getByRole('img', { name: 'Focus light' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'f' });
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.keyDown(window, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.blur(window);
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
  expect(document.documentElement).not.toHaveAttribute('data-canvas-focus');
});

it('respects configurable chords, typing/modal guards, and physical release after modifier release', async () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ defaultsVersion: 2, 'canvas.focus': 'alt+f' }));
  const canvas = setup();
  const input = document.createElement('input'); document.body.append(input);
  fireEvent.keyDown(input, { key: 'f', altKey: true });
  fireEvent.keyDown(window, { key: 'f' });
  expect(document.documentElement).not.toHaveAttribute('data-canvas-focus');
  const modal = document.createElement('div'); modal.setAttribute('aria-modal', 'true'); document.body.append(modal);
  fireEvent.keyDown(window, { key: 'f', altKey: true });
  expect(document.documentElement).not.toHaveAttribute('data-canvas-focus');
  modal.remove();
  fireEvent.keyDown(window, { key: 'f', code: 'KeyF', altKey: true });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.keyUp(window, { key: 'Alt' });
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  fireEvent.keyDown(window, { key: 'f', code: 'KeyF', altKey: true });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.focus(input);
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  input.remove();
});

it('shares one pointer and tail between GM, preview, and player popup with projection letterboxing', async () => {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const popup = frame.contentWindow!;
  vi.spyOn(window, 'open').mockReturnValue(popup);
  vi.spyOn(popup, 'close').mockImplementation(() => {});
  setup();
  fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(window, { key: 'v' });
  const preview = screen.getByLabelText('Player preview viewport');
  mockCanvasBounds(preview, { width: 1000, height: 1000 });
  fireEvent.mouseMove(preview, { clientX: 500, clientY: 500 });
  fireEvent.keyDown(window, { key: 'f' });
  const light = await within(preview).findByRole('img', { name: 'Focus light' });
  await waitFor(() => expect(within(popup.document.body).getByRole('img', { name: 'Focus light' })).toBeInTheDocument());
  const projected = within(popup.document.body).getByRole('img', { name: 'Focus light' });
  for (const graphic of [light, projected]) {
    expect(Number(graphic.querySelector('circle')!.getAttribute('cx'))).toBeCloseTo(500);
    expect(Number(graphic.querySelector('circle')!.getAttribute('cy'))).toBeCloseTo(250);
  }
  fireEvent.mouseMove(preview, { clientX: 500, clientY: 10 });
  await waitFor(() => expect(within(preview).queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  expect(within(popup.document.body).queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument();
  fireEvent.mouseMove(preview, { clientX: 500, clientY: 500 });
  await within(preview).findByRole('img', { name: 'Focus light' });
});

it('does not interrupt a pointer gesture and clears Focus on encounter changes or backgrounding', async () => {
  const canvas = setup();
  fireEvent.pointerMove(canvas, { buttons: 1, clientX: 300, clientY: 200 });
  fireEvent.keyDown(window, { key: 'f' });
  expect(document.documentElement).not.toHaveAttribute('data-canvas-focus');
  fireEvent.pointerUp(canvas, { buttons: 0 });
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present, id: 'another-focus-encounter' })));
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
  expect(document.documentElement).not.toHaveAttribute('data-canvas-focus');
  fireEvent.mouseMove(canvas, { clientX: 300, clientY: 200 });
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  await waitFor(() => expect(screen.queryByRole('img', { name: 'Focus light' })).not.toBeInTheDocument());
});

it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('works without encounter/history/log mutations in %s and read-only tabs', async mode => {
  setup();
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present, validationState: { ...store.getState().encounter.present.validationState, mode } })));
  const history = store.getState().encounter, log = store.getState().encounterLog;
  setPersistenceWritable(false);
  fireEvent.keyDown(window, { key: 'f' });
  await screen.findByRole('img', { name: 'Focus light' });
  fireEvent.keyUp(window, { key: 'f' });
  expect(store.getState().encounter).toBe(history);
  expect(store.getState().encounterLog).toBe(log);
});
