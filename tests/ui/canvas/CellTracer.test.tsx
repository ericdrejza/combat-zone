import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { store } from '@store/store';
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { setActiveTool, setCellTracerActive, setZoneShapeMode } from '@interaction/interactionState';
import { getCanvas, mockCanvasBounds, renderApp } from '@tests/ui/renderApp';
function setup() {
  renderApp();
  const state = createEncounterState({ id: 'tracer-ui', name: 'Tracer' }); state.movementRules.snapZoneVertices = true;
  act(() => { store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('zone')); store.dispatch(setZoneShapeMode('polygon')); store.dispatch(setCellTracerActive(true)); });
  const canvas = getCanvas(); mockCanvasBounds(canvas); return canvas;
}
describe('Cell Tracer drawing checkpoints', () => {
  it('removes all generated turns with the last selected point and commits an ordinary polygon', async () => {
    const canvas = setup();
    fireEvent.click(canvas, { clientX: 64, clientY: 64 });
    fireEvent.click(canvas, { clientX: 192, clientY: 192 });
    expect(screen.getByLabelText('Zone draft').querySelectorAll('circle')).toHaveLength(3);
    fireEvent.contextMenu(canvas);
    expect(screen.getByLabelText('Zone draft').querySelectorAll('circle')).toHaveLength(1);
    fireEvent.click(canvas, { clientX: 192, clientY: 64 });
    fireEvent.click(canvas, { clientX: 192, clientY: 192 });
    fireEvent.click(canvas, { clientX: 64, clientY: 64 });
    await waitFor(() => expect(store.getState().encounter.present.zones.allIds).toHaveLength(1));
    const saved = store.getState().encounter.present;
    expect(saved.zones.byId[saved.zones.allIds[0]]).toMatchObject({ shape: 'polygon', polygon: [{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }] });
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.zones.allIds).toEqual([]);
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present).toEqual(saved);
  });
  it('shows a cell-edge preview and clears the draft on mode changes', () => {
    const canvas = setup(); fireEvent.click(canvas, { clientX: 64, clientY: 64 });
    fireEvent.mouseMove(canvas, { clientX: 192, clientY: 192 });
    expect(canvas.querySelector('[data-cell-tracer-preview]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Rectangle zone shape' }));
    expect(screen.queryByLabelText('Zone draft')).not.toBeInTheDocument();
    expect(store.getState().interaction.cellTracerActive).toBe(false);
  });
  it('previews the exact closing path when hovering the first vertex', async () => {
    const canvas = setup();
    fireEvent.click(canvas, { clientX: 64, clientY: 64 });
    fireEvent.click(canvas, { clientX: 192, clientY: 64 });
    fireEvent.click(canvas, { clientX: 192, clientY: 192 });
    fireEvent.mouseMove(canvas, { clientX: 64, clientY: 64 });
    expect(canvas.querySelector('[data-cell-tracer-preview]')).toHaveAttribute('points', '192,192 64,192 64,64');
    expect(store.getState().encounter.past).toHaveLength(0);
    fireEvent.click(canvas, { clientX: 64, clientY: 64 });
    await waitFor(() => expect(store.getState().encounter.present.zones.allIds).toHaveLength(1));
    expect(store.getState().encounter.present.zones.byId[store.getState().encounter.present.zones.allIds[0]].polygon)
      .toEqual([{ x: 64, y: 64 }, { x: 192, y: 64 }, { x: 192, y: 192 }, { x: 64, y: 192 }]);
  });

});
