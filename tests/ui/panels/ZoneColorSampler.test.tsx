import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store } from '@store/store';
import { createRectangleZone, getCanvas, mockCanvasBounds, renderApp, selectZoneTool } from '@tests/ui/renderApp';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { selectEntity } from '@interaction/interactionState';
import * as backgroundPixels from '@ui/canvas/color_sampler/sampleBackgroundPixel';

describe('Zone color sampling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('leaves colors and history unchanged when background pixels cannot be read', async () => {
    vi.spyOn(backgroundPixels, 'sampleBackgroundPixel').mockRejectedValue(new Error('Unreadable image'));
    const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas); await screen.findByLabelText('Zone 1');
    const state = store.getState().encounter.present, history = store.getState().encounter.past.length;
    const matcher = screen.getByRole('button', { name: 'Background color matcher' });
    await user.click(matcher); fireEvent.click(canvas, { clientX: 300, clientY: 200 });
    await screen.findByRole('alert');
    expect(matcher).toHaveAttribute('aria-pressed', 'false');
    expect(store.getState().encounter.present).toBe(state);
    expect(store.getState().encounter.past).toHaveLength(history);
  });

  it('samples the active color property and supports cancellation and undo/redo', async () => {
    const sample = vi.spyOn(backgroundPixels, 'sampleBackgroundPixel').mockResolvedValue('#123456');
    const user = userEvent.setup();
    renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas);
    await screen.findByLabelText('Zone 1');
    const zoneId = store.getState().encounter.present.zones.allIds[0];
    const before = store.getState().encounter.present.zones.byId[zoneId].colorFill;
    const matcher = () => screen.getByRole('button', { name: 'Background color matcher' });
    const history = store.getState().encounter.past.length;
    await user.click(matcher()); expect(matcher()).toHaveAttribute('aria-pressed', 'true');
    fireEvent.mouseDown(canvas, { button: 2, clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 240, clientY: 200 });
    fireEvent.mouseUp(window, { button: 2 });
    expect(matcher()).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}'); expect(matcher()).toHaveAttribute('aria-pressed', 'false');
    await user.click(matcher());
    fireEvent.mouseDown(canvas, { button: 2, clientX: 200, clientY: 200 });
    fireEvent.mouseUp(window, { button: 2 });
    expect(matcher()).toHaveAttribute('aria-pressed', 'false');
    expect(store.getState().encounter.past).toHaveLength(history);
    expect(sample).not.toHaveBeenCalled();
    await user.click(matcher()); fireEvent.click(canvas, { clientX: 300, clientY: 200 });
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456'));
    expect(matcher()).toHaveAttribute('aria-pressed', 'false');
    expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456');
    await user.click(screen.getByRole('tab', { name: 'Border' }));
    sample.mockResolvedValue('#abcdef');
    await user.click(matcher()); fireEvent.click(canvas, { clientX: 300, clientY: 200 });
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorBorder).toBe('#abcdef'));
    expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456');
    await user.click(screen.getByRole('tab', { name: 'Engagements' }));
    expect(matcher()).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Match border color' }));
    await waitFor(() => expect(matcher()).toBeEnabled());
    sample.mockResolvedValue('#654321');
    await user.click(matcher()); fireEvent.click(canvas, { clientX: 300, clientY: 200 });
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorEngagement).toBe('#654321'));
  });

  it('copies another Zone’s appearance into all selected Zones as one undoable action', async () => {
    const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user);
    createRectangleZone(canvas); await screen.findByLabelText('Zone 1');
    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 360, y: 160 }); await screen.findByLabelText('Zone 2');
    createRectangleZone(canvas, { x: 440, y: 80 }, { x: 540, y: 160 }); await screen.findByLabelText('Zone 3');
    const state = store.getState().encounter.present, [first, second, source] = state.zones.allIds;
    act(() => {
      store.dispatch(loadEncounterState({ ...state, zones: { ...state.zones, byId: { ...state.zones.byId,
        [source]: { ...state.zones.byId[source], colorFill: '#123456', colorBorder: '#abcdef', colorEngagement: '#654321', matchEngagementColorToBorder: false, opacity: 0.4 }
      } } }));
      store.dispatch(selectEntity({ entityType: 'zone', ids: [first, second] }));
    });
    const history = store.getState().encounter.past.length;
    await user.click(screen.getByRole('button', { name: 'Copy colors from zone' }));
    await user.click(screen.getByLabelText('Zone 3'));
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[first].colorFill).toBe('#123456'));
    for (const id of [first, second]) expect(store.getState().encounter.present.zones.byId[id]).toMatchObject({ colorFill: '#123456', colorBorder: '#abcdef', colorEngagement: '#654321', opacity: 0.4 });
    expect(store.getState().interaction.selection.selectedIds).toEqual([first, second]);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[first].colorFill).toBe(state.zones.byId[first].colorFill);
    expect(store.getState().encounter.present.zones.byId[second].colorFill).toBe(state.zones.byId[second].colorFill);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[second].colorFill).toBe('#123456');
    const repeatedHistory = store.getState().encounter.past.length;
    await user.click(screen.getByRole('button', { name: 'Copy colors from zone' }));
    await user.click(screen.getByLabelText('Zone 3'));
    expect(store.getState().encounter.past).toHaveLength(repeatedHistory);
  });
});
