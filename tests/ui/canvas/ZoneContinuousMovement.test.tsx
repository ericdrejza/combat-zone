import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store } from '@store/store';
import { undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import * as runtime from '@core/validation/runtimeEncounterChange';
import type { PreparedValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createRectangleZone, getCanvas, mockCanvasBounds, renderApp, selectZoneTool } from '@tests/ui/renderApp';

describe('continuous Zone movement', () => {
  afterEach(() => vi.restoreAllMocks());

  it('commits a valid placement before settling and restores it after an invalid follow-up drop', async () => {
    const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas); await screen.findByLabelText('Zone 1');
    const id = store.getState().encounter.present.zones.allIds[0];
    const history = store.getState().encounter.past.length;
    fireEvent.mouseDown(screen.getByLabelText('Zone 1'), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 140 });
    fireEvent.mouseUp(canvas, { clientX: 180, clientY: 140 });
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    const lastValid = store.getState().encounter.present.zones.byId[id].polygon;
    fireEvent.mouseDown(screen.getByLabelText('Zone 1'), { button: 0, clientX: 180, clientY: 140 });
    fireEvent.mouseMove(canvas, { clientX: -1000, clientY: -1000 });
    fireEvent.mouseUp(canvas, { clientX: -1000, clientY: -1000 });
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(lastValid);
    expect(store.getState().encounter.past).toHaveLength(history + 1);
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.past).toHaveLength(history);
  });

  it('ignores the earlier drop while a newer drag owns the Zone', async () => {
    const user = userEvent.setup(); renderApp(); const canvas = getCanvas(); mockCanvasBounds(canvas);
    await selectZoneTool(user); createRectangleZone(canvas); await screen.findByLabelText('Zone 1');
    const id = store.getState().encounter.present.zones.allIds[0];
    const original = store.getState().encounter.present.zones.byId[id].polygon;
    const history = store.getState().encounter.past.length;
    const prepare = runtime.prepareValidatedEncounterChangeForRuntime;
    let resolveFirst!: (value: PreparedValidatedEncounterChange) => void;
    let first: PreparedValidatedEncounterChange | Promise<PreparedValidatedEncounterChange>;
    let deferred = false;
    vi.spyOn(runtime, 'prepareValidatedEncounterChangeForRuntime').mockImplementation(input => {
      if (input.action.type !== 'zone.move' || deferred) return prepare(input);
      deferred = true; first = prepare(input);
      return new Promise(resolve => { resolveFirst = resolve; });
    });
    fireEvent.mouseDown(screen.getByLabelText('Zone 1'), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 140 });
    fireEvent.mouseUp(canvas, { clientX: 180, clientY: 140 });
    expect(deferred).toBe(true);
    fireEvent.mouseDown(screen.getByLabelText('Zone 1'), { button: 0, clientX: 180, clientY: 140 });
    fireEvent.mouseMove(canvas, { clientX: 220, clientY: 160 });
    await act(async () => { resolveFirst(await first!); });
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(original);
    expect(store.getState().encounter.past).toHaveLength(history);
    fireEvent.mouseMove(canvas, { clientX: 240, clientY: 180 });
    fireEvent.mouseUp(canvas, { clientX: 240, clientY: 180 });
    await waitFor(() => expect(store.getState().encounter.past).toHaveLength(history + 1));
    const final = store.getState().encounter.present.zones.byId[id].polygon;
    expect(final).toEqual(original.map(point => ({ x: point.x + 140, y: point.y + 80 })));
    act(() => store.dispatch(undoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(original);
    act(() => store.dispatch(redoEncounterChange()));
    expect(store.getState().encounter.present.zones.byId[id].polygon).toEqual(final);
  });
});
