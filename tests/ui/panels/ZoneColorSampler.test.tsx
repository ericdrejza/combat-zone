import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store } from '@store/store';
import { createRectangleZone, getCanvas, mockCanvasBounds, renderApp, selectZoneTool } from '@tests/ui/renderApp';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { selectEntity } from '@interaction/interactionState';

describe('Zone color sampling', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('leaves colors and history unchanged when screen sampling fails', async () => {
    const open = vi.fn().mockRejectedValue(new Error('Screen picker failed'));
    vi.stubGlobal('EyeDropper', class { open = open; });
    const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas); await screen.findByLabelText('Zone 1');
    const state = store.getState().encounter.present, history = store.getState().encounter.past.length;
    const picker = screen.getByRole('button', { name: 'Pick fill color from screen' });
    await user.click(picker);
    await within(screen.getByRole('group', { name: 'Fill color palette' })).findByRole('status');
    expect(picker).toBeEnabled(); expect(open).toHaveBeenCalledOnce();
    expect(store.getState().encounter.present).toBe(state);
    expect(store.getState().encounter.past).toHaveLength(history);
  });

  it('samples the active color property and supports cancellation and undo/redo', async () => {
    const open = vi.fn().mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError')).mockResolvedValue({ sRGBHex: '#123456' });
    vi.stubGlobal('EyeDropper', class { open = open; });
    const user = userEvent.setup();
    renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas);
    await screen.findByLabelText('Zone 1');
    const zoneId = store.getState().encounter.present.zones.allIds[0];
    const before = store.getState().encounter.present;
    const history = store.getState().encounter.past.length;
    await user.click(screen.getByRole('button', { name: 'Pick fill color from screen' }));
    expect(store.getState().encounter.present).toBe(before);
    expect(store.getState().encounter.past).toHaveLength(history);
    expect(within(screen.getByRole('group', { name: 'Fill color palette' })).queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pick fill color from screen' }));
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456'));
    expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present).toEqual(before);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456');
    await user.click(screen.getByRole('tab', { name: 'Border' }));
    open.mockResolvedValue({ sRGBHex: '#abcdef' });
    await user.click(screen.getByRole('button', { name: 'Pick border color from screen' }));
    await waitFor(() => expect(store.getState().encounter.present.zones.byId[zoneId].colorBorder).toBe('#abcdef'));
    expect(store.getState().encounter.present.zones.byId[zoneId].colorFill).toBe('#123456');
    await user.click(screen.getByRole('tab', { name: 'Engagements' }));
    const engagementPicker = screen.getByRole('button', { name: 'Pick engagements color from screen' });
    expect(engagementPicker).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: 'Match border color' }));
    await waitFor(() => expect(engagementPicker).toBeEnabled());
    open.mockResolvedValue({ sRGBHex: '#654321' });
    await user.click(engagementPicker);
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
