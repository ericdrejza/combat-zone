import { act, fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import { store } from "@store/store";
import { loadEncounterState } from "@store/encounterSlice";
import { setActiveTool } from "@interaction/interactionState";
import { scopedReferenceEncounter } from "@tests/core/dice/fixtures";
import { snapshotReferences } from "@core/dice/referenceSnapshots";
import { ChatMessageText } from "@ui/dice/ChatMessageText";
import { TARGET_PREVIEW_EVENT } from "@ui/dice/MentionSuggestions";
import { CanvasViewportContext, type CanvasViewportValue } from "@ui/canvas/CanvasViewportContext";
import { InterfacePreferenceProvider } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { ChatSettings } from "@ui/settings/ChatSettings";
import userEvent from "@testing-library/user-event";

beforeEach(() => localStorage.clear());
function setup(width = 800, rename = false, stale = false) {
  const state = scopedReferenceEncounter(); state.movementRules.zoneLocked = false;
  for (const [index, id] of ['a', 'd', 'c', 'b'].entries()) state.actors.byId[id].spatialPosition = { x: 100 + index * 50, y: 100 };
  const message = '@[Zone1,Zone2].heroes'; const references = snapshotReferences(state, message);
  if (rename) state.zones.byId.z1.name = 'Renamed';
  if (stale) {
    delete state.zones.byId.z1; state.zones.allIds = ['z2', 'replacement'];
    state.zones.byId.replacement = { ...state.zones.byId.z2, id: 'replacement', name: 'Zone1' };
    state.actors.byId.a.currentZoneId = 'zoneless'; state.actors.byId.d.currentZoneId = 'zoneless';
  }
  store.dispatch(loadEncounterState(state)); store.dispatch(setActiveTool('select'));
  const viewport: CanvasViewportValue = {
    zoom: 2, viewportSize: { width, height: 600 }, getViewportSize: () => ({ width, height: 600 }),
    panEnabled: true, stopPanAnimation: vi.fn(), pan: vi.fn(), panToPoint: vi.fn(), registerViewport: vi.fn(),
    zoomIn: vi.fn(), zoomOut: vi.fn(), resetZoom: vi.fn(), beginTemporaryMaxZoom: () => () => {},
    setZoomAtPoint: vi.fn(), zoomByWheelAtPoint: vi.fn(), zoomToFit: vi.fn(), zoomToFitHeight: vi.fn(), zoomToFitWidth: vi.fn()
  };
  render(<Provider store={store}><InterfacePreferenceProvider><CanvasViewportContext.Provider value={viewport}>
    <ChatSettings /><ChatMessageText message={message} references={references} />
  </CanvasViewportContext.Provider></InterfacePreferenceProvider></Provider>);
  return { viewport, before: store.getState().encounter };
}
it('selects the scoped Actor union on click and pans on double-click only when every token fits', () => {
  const { viewport, before } = setup(); const group = screen.getByRole('button', { name: 'heroes' });
  const preview = vi.fn(); window.addEventListener(TARGET_PREVIEW_EVENT, preview);
  try {
    fireEvent.mouseEnter(group); expect(preview.mock.calls.at(-1)![0].detail).toEqual(['a', 'd', 'c']);
    fireEvent.click(group);
    expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd', 'c']);
    expect(viewport.panToPoint).not.toHaveBeenCalled();
    fireEvent.doubleClick(group);
    expect(viewport.panToPoint).toHaveBeenCalledWith({ x: 150, y: 100 }, { animate: true });
    expect(viewport.setZoomAtPoint).not.toHaveBeenCalled(); expect(viewport.zoomToFit).not.toHaveBeenCalled();
    expect(store.getState().encounter).toBe(before);
  } finally { window.removeEventListener(TARGET_PREVIEW_EVENT, preview); }
});
it('selects the union without moving when it cannot fit at the current zoom', () => {
  const { viewport } = setup(10);
  fireEvent.click(screen.getByRole('button', { name: 'heroes' }));
  fireEvent.doubleClick(screen.getByRole('button', { name: 'heroes' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd', 'c']);
  expect(viewport.panToPoint).not.toHaveBeenCalled();
});
it('navigates once for a native double-click sequence', async () => {
  const user = userEvent.setup();
  const { viewport } = setup();
  await user.dblClick(screen.getByRole('button', { name: 'heroes' }));
  expect(viewport.panToPoint).toHaveBeenCalledOnce();
});
it('switches to Select before selecting and navigating a faction union from the Zone tool', () => {
  const { viewport } = setup(); act(() => store.dispatch(setActiveTool('zone')));
  fireEvent.click(screen.getByRole('button', { name: 'heroes' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd', 'c']);
  expect(store.getState().interaction.activeToolId).toBe('select');
  expect(viewport.panToPoint).not.toHaveBeenCalled();
  fireEvent.doubleClick(screen.getByRole('button', { name: 'heroes' }));
  expect(viewport.panToPoint).toHaveBeenCalledOnce();
});
it('uses saved parent identities when their names have changed', () => {
  setup(800, true);
  fireEvent.click(screen.getByRole('button', { name: 'heroes' }));
  expect(store.getState().interaction.selection.selectedIds).toEqual(['a', 'd', 'c']);
});
it('shows the click-only stale warning instead of substituting a same-named replacement parent', () => {
  const { viewport } = setup(800, false, true);
  const before = store.getState().interaction.selection;
  const group = screen.getByRole('button', { name: 'heroes' });
  fireEvent.mouseEnter(group); expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.click(group); expect(screen.getByRole('tooltip')).toHaveTextContent('Stale reference');
  expect(store.getState().interaction.selection).toBe(before); expect(viewport.panToPoint).not.toHaveBeenCalled();
});
