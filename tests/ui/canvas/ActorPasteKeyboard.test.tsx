import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useDispatch, useSelector, Provider } from "react-redux";
import type { RootState } from "@store/store";
import { store } from "@store/store";
import { loadEncounterState, undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setActiveTool, selectEntity, setActorToolTargetZone, resetInteractionState } from "@interaction/interactionState";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { KeybindProvider } from "@ui/keybinds";
import { ZoneResizeApprovalProvider } from "@ui/zoneResizeApproval";
import { useCanvasKeyboard } from "@ui/canvas/useCanvasKeyboard";
import { encounter } from "./actors/actorKeyboardTestSupport";

function Harness() {
  const dispatch = useDispatch(); const state = useSelector((state: RootState) => state);
  useCanvasKeyboard({ activeToolId: state.interaction.activeToolId, actorPaintBrush: state.interaction.actorPaintBrush, actorTool: state.interaction.actorTool, clearShapeDraft: () => {}, clearZoneDraftPoints: () => {}, closeZoneShapeMenu: () => {}, dispatch, encounter: state.encounter.present, selection: state.interaction.selection, zonePaintBrush: state.interaction.zonePaintBrush });
  return null;
}
function setup(zoneless = false) {
  const initial = encounter(); if (zoneless) initial.actors.byId.alpha.currentZoneId = "zoneless";
  store.dispatch(loadEncounterState(initial)); store.dispatch(resetInteractionState()); store.dispatch(setActiveTool("actor")); store.dispatch(selectEntity({ entityType: "actor", ids: ["alpha"] })); store.dispatch(setActorToolTargetZone("b"));
  render(<Provider store={store}><KeybindProvider><ZoneResizeApprovalProvider><Harness /></ZoneResizeApprovalProvider></KeybindProvider></Provider>);
  fireEvent.keyDown(window, { key: "c", ctrlKey: true });
}
const paste = () => fireEvent.keyDown(window, { key: "v", ctrlKey: true });
beforeEach(() => { localStorage.clear(); setPersistenceWritable(true); });
afterEach(() => setPersistenceWritable(true));
describe("validated actor paste", () => {
  it.each([false, true])("pastes source-first with selected-zone fallback (zoneless=%s) and undo/redo", async (zoneless) => {
    setup(zoneless); paste(); await waitFor(() => expect(store.getState().encounter.present.actors.allIds).toHaveLength(3));
    const copy = store.getState().interaction.selection.selectedIds[0];
    expect(store.getState().encounter.present.actors.byId[copy].currentZoneId).toBe(zoneless ? "b" : "zone-a");
    expect(store.getState().encounter.past).toHaveLength(1);
    act(() => store.dispatch(undoEncounterChange())); expect(store.getState().encounter.present.actors.byId[copy]).toBeUndefined();
    act(() => store.dispatch(redoEncounterChange())); expect(store.getState().encounter.present.actors.byId[copy].name).toBe("Alpha Copy");
  });
  it("rejects impossible copies without replacing selection and blocks read-only paste", async () => {
    setup(); const current = store.getState().encounter.present;
    const impossible = structuredClone(current); impossible.zones.byId['zone-a'].polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    act(() => store.dispatch(loadEncounterState(impossible))); paste();
    await waitFor(() => expect(store.getState().encounterLog.entries.length).toBeGreaterThan(0));
    expect(store.getState().encounter.present.actors.allIds).toHaveLength(2); expect(store.getState().interaction.selection.selectedIds).toEqual(["alpha"]);
    setPersistenceWritable(false); paste(); expect(store.getState().encounter.past).toHaveLength(0);
  });
});
