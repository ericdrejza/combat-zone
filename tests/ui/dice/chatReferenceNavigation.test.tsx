import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setActiveTool } from "@interaction/interactionState";
import { diceEncounter } from "@tests/core/dice/fixtures";
import { createZone } from "@entities/zone/zoneMutations";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { CanvasViewportContext, type CanvasViewportValue } from "@ui/canvas/CanvasViewportContext";
import { ActorStatusNavigationProvider } from "@ui/panels/status_panel/ActorStatusNavigationProvider";
import { ActorStatusImage } from "@ui/panels/status_panel/ActorStatusImage";

beforeEach(() => localStorage.clear());
function setup(spatial = false) {
  const state = createZone(diceEncounter(), { id: 'z', name: 'Courtyard', polygon: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 500 }, { x: 100, y: 500 }] });
  state.actors.byId.b.currentZoneId = spatial ? 'zoneless' : 'z';
  if (spatial) { state.movementRules.zoneLocked = false; state.actors.byId.b.spatialPosition = { x: 720, y: 460 }; }
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('select'));
  const viewport: CanvasViewportValue = {
    zoom: 2, viewportSize: { width: 800, height: 600 }, getViewportSize: () => ({ width: 800, height: 600 }),
    panEnabled: true, stopPanAnimation: vi.fn(), pan: vi.fn(), panToPoint: vi.fn(), registerViewport: vi.fn(),
    zoomIn: vi.fn(), zoomOut: vi.fn(), resetZoom: vi.fn(), beginTemporaryMaxZoom: () => () => {},
    setZoomAtPoint: vi.fn(), zoomByWheelAtPoint: vi.fn(), zoomToFit: vi.fn(), zoomToFitHeight: vi.fn(), zoomToFitWidth: vi.fn()
  };
  const message = '@Guard @Courtyard @Scout';
  render(<Provider store={store}><CanvasViewportContext.Provider value={viewport}>
    <ChatMessageText message={message} references={snapshotReferences(state, message)} />
    <ActorStatusNavigationProvider><ActorStatusImage actor={state.actors.byId.b} src="/token.png" className="" /></ActorStatusNavigationProvider>
  </CanvasViewportContext.Provider></Provider>);
  return { viewport, history: store.getState().encounter };
}
it.each([false, true])('selects on click and navigates like Status images only on double-click (spatial=%s)', spatial => {
  const { viewport, history } = setup(spatial);
  fireEvent.click(screen.getByRole('button', { name: 'Center viewport on Guard' }));
  const imageCall = vi.mocked(viewport.panToPoint).mock.calls[0];
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(viewport.panToPoint).toHaveBeenCalledOnce();
  expect(store.getState().interaction.selection.selectedIds).toEqual(['b']);
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(vi.mocked(viewport.panToPoint).mock.calls[1]).toEqual(imageCall);
  if (spatial) expect(imageCall[0]).toEqual({ x: 720, y: 460 });
  expect(viewport.setZoomAtPoint).not.toHaveBeenCalled(); expect(store.getState().encounter).toBe(history);
});
it('selects a Zone on click and centers its geometry on double-click', () => {
  const { viewport } = setup(); const reference = screen.getByRole('button', { name: '@Courtyard' });
  fireEvent.click(reference); expect(store.getState().interaction.selection.selectedIds).toEqual(['z']);
  expect(viewport.panToPoint).not.toHaveBeenCalled();
  fireEvent.doubleClick(reference); expect(viewport.panToPoint).toHaveBeenCalledWith({ x: 300, y: 300 }, { animate: true });
});
it('switches incompatible tools before selection and only navigates on double-click', () => {
  const { viewport } = setup(); act(() => { store.dispatch(setActiveTool('zone')); });
  fireEvent.click(screen.getByRole('button', { name: '@Guard' }));
  expect(viewport.panToPoint).not.toHaveBeenCalled(); expect(store.getState().interaction.activeToolId).toBe('select');
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' })); expect(viewport.panToPoint).toHaveBeenCalledOnce();
  vi.mocked(viewport.panToPoint).mockClear();
  fireEvent.doubleClick(screen.getByRole('button', { name: '@Scout' })); expect(viewport.panToPoint).not.toHaveBeenCalled();
  expect(store.getState().interaction.selection.selectedIds).toEqual(['c']);
});
it('navigates once for a native double-click sequence and keeps keyboard activation selection-only', async () => {
  const user = userEvent.setup(); const { viewport } = setup(); const reference = screen.getByRole('button', { name: '@Guard' });
  reference.focus(); await user.keyboard('{Enter}'); expect(viewport.panToPoint).not.toHaveBeenCalled();
  await user.dblClick(reference); expect(viewport.panToPoint).toHaveBeenCalledOnce();
  expect(store.getState().interaction.selection.selectedIds).toEqual(['b']);
});
it('keeps stale references warning-only on either gesture', () => {
  const { viewport } = setup(); const deleted = structuredClone(store.getState().encounter.present);
  delete deleted.actors.byId.b; deleted.actors.allIds = deleted.actors.allIds.filter(id => id !== 'b');
  act(() => { store.dispatch(loadEncounterState(deleted)); }); const selection = store.getState().interaction.selection;
  fireEvent.click(screen.getByRole('button', { name: '@Guard' })); fireEvent.doubleClick(screen.getByRole('button', { name: '@Guard' }));
  expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  expect(viewport.panToPoint).not.toHaveBeenCalled(); expect(store.getState().interaction.selection).toBe(selection);
});
