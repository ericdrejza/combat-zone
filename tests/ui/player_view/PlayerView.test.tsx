import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp } from '@tests/ui/renderApp';
import { store } from '@store/store';
import { createActor, updateActorProperties } from '@entities/actor/actorMutations';
import { buildZone } from '@entities/zone/zoneMutations';
import { DEFAULT_EDGE_PRESET } from '@entities/edge/edgeMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { commitEncounterChange, loadEncounterState, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { selectEntity, setActiveTool, setNamePreview, clearNamePreview, setRulerDraft } from '@interaction/interactionState';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { CANVAS_PREFERENCES_KEY, DEFAULT_CANVAS_PREFERENCES, saveCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { KEYBIND_STORAGE_KEY } from '@ui/keybinds';

function playerToggle(name: 'Toggle player window' | 'Toggle player preview' | 'Follow GM view') {
  if (!screen.queryByRole('button', { name })) fireEvent.click(screen.getByRole('button', { name: 'More zoom options' }));
  return screen.getByRole('button', { name });
}

function mockPopup() {
  const frame = document.createElement('iframe'); document.body.append(frame);
  const popup = frame.contentWindow!;
  const close = vi.spyOn(popup, 'close').mockImplementation(() => {});
  const open = vi.spyOn(window, 'open').mockReturnValue(popup);
  return { popup, close, open };
}
function seed() {
  const zone = buildZone({ id: 'z', name: 'Arena', shape: 'rectangle', polygon: [{ x: 50, y: 50 }, { x: 400, y: 50 }, { x: 400, y: 400 }, { x: 50, y: 400 }] });
  const target = buildZone({ ...zone, id: 'target', name: 'Exit', polygon: zone.polygon.map(point => ({ x: point.x + 500, y: point.y })) });
  let encounter = store.getState().encounter.present;
  encounter = { ...encounter, zones: { byId: { z: zone, target }, allIds: ['z', 'target'] },
    edges: { allIds: ['e'], byId: { e: { ...DEFAULT_EDGE_PRESET, id: 'e', fromZoneId: 'z', toZoneId: 'target', movementRules: ['skillCheck', 'difficult'], interactionTags: [] } } } };
  encounter = createActor(encounter, { id: 'a', name: 'Hero', currentZoneId: 'z' });
  act(() => { store.dispatch(loadEncounterState(encounter)); store.dispatch(setActiveTool('select')); store.dispatch(selectEntity({ entityType: 'actor', ids: ['a'] })); });
}
afterEach(() => {
  setPersistenceWritable(true); vi.restoreAllMocks();
  localStorage.removeItem(CANVAS_PREFERENCES_KEY); localStorage.removeItem(KEYBIND_STORAGE_KEY);
  document.querySelectorAll('iframe').forEach(frame => frame.remove());
});

it('mirrors the live scene, hides editor affordances and Skill Check badges, and follows undo/redo', async () => {
  const { popup } = mockPopup();
  renderApp(); seed();
  fireEvent.click(playerToggle('Toggle player window'));
  fireEvent.click(playerToggle('Toggle player preview'));
  const preview = screen.getByRole('region', { name: 'Player preview' });
  const output = popup.document.getElementById('player-root')!;
  expect(screen.queryByRole('navigation', { name: 'Tools' })).not.toBeInTheDocument();
  expect(within(output).getAllByRole('button')).toEqual([within(output).getByRole('button', { name: 'Fullscreen unavailable in this browser' })]);
  await waitFor(() => expect(within(output).getByLabelText('Hero')).toBeInTheDocument());
  for (const root of [preview, output]) {
    expect(within(root).queryByLabelText('Skill check')).not.toBeInTheDocument();
    expect(within(root).getByLabelText('Difficult')).toBeInTheDocument();
    expect(root.querySelector('[tabindex="0"][data-entity-type]')).toBeNull();
  }
  act(() => { store.dispatch(commitEncounterChange({ action: createEncounterActionRecord('actor.rename'), nextEncounter: updateActorProperties(store.getState().encounter.present, 'a', { name: 'Renamed' }) })); });
  await waitFor(() => expect(within(output).getByLabelText('Renamed')).toBeInTheDocument());
  expect(within(preview).getByLabelText('Renamed')).toBeInTheDocument();
  act(() => { store.dispatch(undoEncounterChange()); });
  expect(within(output).getByLabelText('Hero')).toBeInTheDocument();
  act(() => { store.dispatch(redoEncounterChange()); });
  expect(within(output).getByLabelText('Renamed')).toBeInTheDocument();
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  fireEvent.click(within(preview).getByRole('button', { name: 'Exit player preview' }));
  expect(screen.getByRole('navigation', { name: 'Tools' })).toBeInTheDocument();
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a']);
});

it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('keeps all projection controls outside history in %s and read-only tabs', mode => {
  renderApp(); seed();
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present, validationState: { ...store.getState().encounter.present.validationState, mode } })));
  const before = store.getState().encounter, log = store.getState().encounterLog;
  setPersistenceWritable(false);
  fireEvent.click(playerToggle('Toggle player preview'));
  fireEvent.click(playerToggle('Follow GM view'));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Player aspect ratio' }), { target: { value: '4:3' } });
  fireEvent.keyDown(window, { key: 'Delete' });
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(store.getState().encounter).toBe(before);
  expect(store.getState().encounterLog).toBe(log);
});

it('uses session aspect-ratio overrides, keeps them across encounters, and resets follow on load', () => {
  saveCanvasPreferences({ ...DEFAULT_CANVAS_PREFERENCES, playerAspectRatio: { width: 4, height: 3 } });
  renderApp();
  fireEvent.click(playerToggle('Toggle player preview'));
  expect(screen.getByRole('combobox', { name: 'Player aspect ratio' })).toHaveValue('4:3');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '21:9' } });
  fireEvent.click(playerToggle('Follow GM view'));
  expect(playerToggle('Follow GM view')).toHaveAttribute('aria-pressed', 'false');
  act(() => store.dispatch(loadEncounterState({ ...store.getState().encounter.present, id: 'another' })));
  expect(playerToggle('Follow GM view')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('combobox')).toHaveValue('21:9');
  expect(JSON.parse(localStorage.getItem(CANVAS_PREFERENCES_KEY)!).playerAspectRatio).toEqual({ width: 4, height: 3 });
});

it('updates both projection frames when changing aspect ratio without changing the followed region', () => {
  const { popup } = mockPopup();
  renderApp();
  fireEvent.click(playerToggle('Toggle player window'));
  fireEvent.click(playerToggle('Toggle player preview'));
  const preview = screen.getByRole('region', { name: 'Player preview' });
  const projection = within(preview).getByRole('img', { name: 'Player encounter view' });
  const output = within(popup.document.body).getByRole('img', { name: 'Player encounter view' });
  const region = projection.querySelector('svg')!.getAttribute('viewBox');
  fireEvent.change(screen.getByRole('combobox', { name: 'Player aspect ratio' }), { target: { value: '4:3' } });
  expect(projection).toHaveAttribute('viewBox', '0 0 1440 1080');
  expect(output).toHaveAttribute('viewBox', '0 0 1440 1080');
  expect(projection.querySelector('svg')).toHaveAttribute('viewBox', region);
  expect(output.querySelector('svg')).toHaveAttribute('viewBox', region);
});

it('controls player-window fullscreen from the GM preview header and tracks window exits', async () => {
  const { popup } = mockPopup();
  let fullscreen: Element | null = null;
  const change = (element: Element | null) => {
    fullscreen = element;
    popup.document.dispatchEvent(new Event('fullscreenchange'));
  };
  Object.defineProperties(popup.document, {
    fullscreenEnabled: { configurable: true, value: true },
    fullscreenElement: { configurable: true, get: () => fullscreen },
    exitFullscreen: { configurable: true, value: vi.fn(async () => change(null)) }
  });
  const enter = vi.fn(async () => change(popup.document.documentElement));
  Object.defineProperty(popup.document.documentElement, 'requestFullscreen', { configurable: true, value: enter });
  Object.defineProperty(popup.navigator, 'permissions', { configurable: true, value: {
    query: vi.fn(async () => Object.assign(new EventTarget(), { state: 'granted' }))
  } });
  renderApp();
  fireEvent.click(playerToggle('Toggle player preview'));
  const header = within(screen.getByRole('banner', { name: 'Player preview controls' }));
  expect(header.getByRole('button', { name: 'Open the player window to use fullscreen' })).toBeDisabled();
  fireEvent.click(playerToggle('Toggle player window'));
  const history = store.getState().encounter;
  fireEvent.click(await header.findByRole('button', { name: 'Enter player window fullscreen' }));
  expect(enter).toHaveBeenCalledOnce();
  expect(header.getByRole('button', { name: 'Exit player window fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(popup.document.body).getByRole('button', { name: 'Exit player window fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(header.getByRole('button', { name: 'Exit player window fullscreen' }));
  expect(popup.document.exitFullscreen).toHaveBeenCalledOnce();
  act(() => change(popup.document.documentElement));
  act(() => change(null));
  expect(header.getByRole('button', { name: 'Enter player window fullscreen' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(playerToggle('Toggle player window'));
  expect(header.getByRole('button', { name: 'Open the player window to use fullscreen' })).toBeDisabled();
  expect(store.getState().encounter).toBe(history);
});

it('shares the GM keyboard handoff with the player window without requiring its fullscreen button', () => {
  const { popup } = mockPopup();
  const focus = vi.spyOn(popup, 'focus').mockImplementation(() => {});
  let fullscreen: Element | null = null;
  Object.defineProperties(popup.document, {
    fullscreenEnabled: { configurable: true, value: true },
    fullscreenElement: { configurable: true, get: () => fullscreen },
    exitFullscreen: { configurable: true, value: vi.fn(async () => {}) }
  });
  const enter = vi.fn(async () => {
    fullscreen = popup.document.documentElement;
    popup.document.dispatchEvent(new Event('fullscreenchange'));
  });
  Object.defineProperty(popup.document.documentElement, 'requestFullscreen', { configurable: true, value: enter });
  renderApp();
  fireEvent.click(playerToggle('Toggle player preview'));
  fireEvent.click(playerToggle('Toggle player window'));
  const header = within(screen.getByRole('banner', { name: 'Player preview controls' }));
  const output = within(popup.document.body);
  const history = store.getState().encounter;
  fireEvent.click(header.getByRole('button', { name: 'Focus player window, then press Enter or Spacebar for fullscreen' }));
  expect(focus).toHaveBeenCalledOnce();
  expect(header.getByRole('status', { name: 'Player window fullscreen status' })).toBeInTheDocument();
  expect(output.getByRole('status', { name: 'Player window fullscreen status' })).toBeInTheDocument();
  expect(enter).not.toHaveBeenCalled();
  fireEvent.keyDown(popup, { key: 'Enter' });
  expect(enter).toHaveBeenCalledOnce();
  expect(header.getByRole('button', { name: 'Exit player window fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  expect(output.getByRole('button', { name: 'Exit player window fullscreen' })).toHaveAttribute('aria-pressed', 'true');
  expect(header.queryByRole('status', { name: 'Player window fullscreen status' })).not.toBeInTheDocument();
  expect(output.queryByRole('status', { name: 'Player window fullscreen status' })).not.toBeInTheDocument();
  expect(store.getState().encounter).toBe(history);
});

it('handles custom shortcuts, typing and repeats, manual popup closure and popup blocking', () => {
  localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ defaultsVersion: 1, 'player.preview': 'alt+v' }));
  const { popup, close, open } = mockPopup();
  renderApp();
  fireEvent.keyDown(window, { key: 'v', altKey: true, repeat: true });
  expect(screen.queryByRole('region', { name: 'Player preview' })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'v', altKey: true });
  expect(screen.getByRole('region', { name: 'Player preview' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true });
  expect(open).toHaveBeenCalledOnce();
  fireEvent.keyDown(popup, { key: 'v', ctrlKey: true, shiftKey: true });
  expect(close).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true });
  act(() => popup.dispatchEvent(new Event('beforeunload')));
  expect(playerToggle('Toggle player window')).toHaveAttribute('aria-pressed', 'false');
  open.mockReturnValue(null);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
  fireEvent.keyDown(window, { key: 'v', ctrlKey: true, shiftKey: true });
  expect(alert).toHaveBeenCalledWith(expect.stringContaining('popup was blocked'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Player aspect ratio width' }), { key: 'v', altKey: true });
  expect(screen.getByRole('region', { name: 'Player preview' })).toBeInTheDocument();
});

it('shares live name drafts and ruler measurements without projecting ruler controls', () => {
  const { popup } = mockPopup(); renderApp(); seed();
  fireEvent.click(playerToggle('Toggle player window'));
  const output = popup.document.getElementById('player-root')!;
  const before = store.getState().encounter;
  act(() => store.dispatch(setNamePreview({ owner: 'test', encounterId: before.present.id, kind: 'actor', ids: ['a'], name: 'Draft hero' })));
  expect(within(output).getByLabelText('Draft hero')).toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
  act(() => { store.dispatch(clearNamePreview('test')); store.dispatch(setActiveTool('ruler')); store.dispatch(setRulerDraft({ points: [{ x: 128, y: 128 }, { x: 256, y: 128 }], complete: false })); });
  expect(within(output).getByLabelText('Hero')).toBeInTheDocument();
  expect(within(output).getByLabelText('Measurement result')).toBeInTheDocument();
  expect(within(output).getAllByRole('button')).toEqual([within(output).getByRole('button', { name: 'Fullscreen unavailable in this browser' })]);
  expect(within(output).queryByLabelText('Ruler drawing surface')).not.toBeInTheDocument();
  expect(store.getState().encounter).toBe(before);
});

it('uses V for preview and S for Select without changing the selected tool during preview', () => {
  renderApp();
  fireEvent.keyDown(window, { key: 's' });
  expect(store.getState().interaction.activeToolId).toBe('select');
  fireEvent.keyDown(window, { key: 'v' });
  expect(screen.getByRole('region', { name: 'Player preview' })).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'a' });
  expect(store.getState().interaction.activeToolId).toBe('select');
  fireEvent.keyDown(window, { key: 'v' });
  expect(screen.queryByRole('region', { name: 'Player preview' })).not.toBeInTheDocument();
});

it('keeps both toggles in the extended zoom dropdown in GM and preview navigation', () => {
  const { open, close } = mockPopup(); renderApp();
  expect(screen.queryByRole('button', { name: 'Toggle player preview' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Toggle player window' })).not.toBeInTheDocument();
  const previewToggle = playerToggle('Toggle player preview');
  const menu = screen.getByRole('toolbar', { name: 'Extended zoom options' });
  expect(within(menu).getAllByRole('button').slice(0, 3).map(button => button.getAttribute('aria-label'))).toEqual(['Follow GM view', 'Toggle player preview', 'Toggle player window']);
  expect(within(menu).getByRole('button', { name: 'Toggle player preview' })).toBe(previewToggle);
  fireEvent.click(within(menu).getByRole('button', { name: 'Toggle player window' }));
  expect(open).toHaveBeenCalledOnce();
  expect(screen.getByRole('toolbar', { name: 'Extended zoom options' })).toBe(menu);
  // Keep the menu open on the active header, without a stale editor portal.
  playerToggle('Toggle player preview');
  fireEvent.keyDown(window, { key: 'v' });
  expect(screen.getAllByRole('toolbar', { name: 'Extended zoom options' })).toHaveLength(1);
  expect(playerToggle('Toggle player preview')).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(playerToggle('Toggle player window'));
  expect(close).toHaveBeenCalledOnce();
  fireEvent.click(playerToggle('Toggle player preview'));
  expect(screen.queryByRole('region', { name: 'Player preview' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('toolbar', { name: 'Extended zoom options' })).toHaveLength(1);
  expect(playerToggle('Toggle player preview')).toHaveAttribute('aria-pressed', 'false');
});

it('exposes both toggles through the compact zoom controls', () => {
  const original = window.matchMedia;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(width < 1024px)', media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn()
  }));
  try {
    mockPopup(); renderApp();
    expect(screen.queryByRole('button', { name: 'Toggle player preview' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom controls' }));
    const previewToggle = playerToggle('Toggle player preview');
    expect(screen.getByRole('toolbar', { name: 'Extended zoom options' })).toContainElement(previewToggle);
    fireEvent.click(playerToggle('Toggle player window'));
    fireEvent.click(playerToggle('Toggle player preview'));
    expect(screen.getByRole('region', { name: 'Player preview' })).toBeInTheDocument();
    expect(playerToggle('Toggle player preview')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(playerToggle('Toggle player preview'));
    expect(screen.getAllByRole('toolbar', { name: 'Extended zoom options' })).toHaveLength(1);
    expect(playerToggle('Toggle player preview')).toHaveAttribute('aria-pressed', 'false');
  } finally { window.matchMedia = original; }
});

it.each(['GM', 'preview'])('keeps the extended zoom dropdown open when toggling Follow GM view in %s', view => {
  renderApp();
  if (view === 'preview') fireEvent.keyDown(window, { key: 'v' });
  const follow = playerToggle('Follow GM view');
  const menu = screen.getByRole('toolbar', { name: 'Extended zoom options' });
  expect(follow).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(follow);
  expect(screen.getByRole('toolbar', { name: 'Extended zoom options' })).toBe(menu);
  expect(follow).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(follow);
  expect(screen.getByRole('toolbar', { name: 'Extended zoom options' })).toBe(menu);
  expect(follow).toHaveAttribute('aria-pressed', 'true');
});
