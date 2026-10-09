import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { vi } from "vitest";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { loadEncounterState } from "@store/encounterSlice";
import { resetInteractionState } from "@interaction/interactionState";
import { store } from "@store/store";
import { KeybindProvider, KEYBIND_STORAGE_KEY } from "@ui/keybinds";
import { WorkspaceKeyboardShortcuts } from "@ui/keybinds/WorkspaceKeyboardShortcuts";
import { CanvasViewportProvider } from "@ui/canvas/CanvasViewportContext";
import { CanvasViewport } from "@ui/canvas/CanvasViewport";

const audio = vi.hoisted(() => ({ hasRunningPlayback: false, hasPausedPlayback: false, pauseAll: vi.fn(), resumeAll: vi.fn() }));
vi.mock("@ui/audio/AudioPlaybackProvider", () => ({ useAudioPlayback: () => audio }));
beforeEach(() => { localStorage.clear(); audio.hasRunningPlayback = false; audio.hasPausedPlayback = false; vi.clearAllMocks(); store.dispatch(loadEncounterState(createEncounterState({ id: "shortcuts", name: "Shortcuts" }))); store.dispatch(resetInteractionState()); });
function setup() {
  const open = vi.fn();
  const view = render(<Provider store={store}><KeybindProvider><CanvasViewportProvider><WorkspaceKeyboardShortcuts onOpenLibrary={open} /><CanvasViewport canvasSize={{ width: 960, height: 640 }}><input aria-label="Editor" /></CanvasViewport></CanvasViewportProvider></KeybindProvider></Provider>);
  return { ...view, open };
}
const key = (value: string, ctrlKey = false) => fireEvent.keyDown(window, { key: value, ctrlKey });
describe("workspace keyboard shortcuts", () => {
  it('honors customized zoom bindings in Grid settings but keeps other modals protected', () => {
    localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ 'viewport.zoomIn': 'ctrl+q' }));
    const view = setup(), viewport = screen.getByLabelText('Canvas viewport');
    const modal = document.createElement('div'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('data-grid-settings-dialog', ''); document.body.append(modal);
    try {
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'q', ctrlKey: true }); expect(viewport).toHaveAttribute('data-canvas-zoom', '1.1');
      key('l'); key('p'); expect(view.open).not.toHaveBeenCalled(); expect(audio.pauseAll).not.toHaveBeenCalled();
      modal.removeAttribute('data-grid-settings-dialog');
      key('q', true); expect(viewport).toHaveAttribute('data-canvas-zoom', '1.1');
    } finally { modal.remove(); }
  });
  it("zooms with punctuation and fits each axis without encounter history", async () => {
    setup(); const viewport = screen.getByLabelText("Canvas viewport");
    Object.defineProperty(viewport, "clientWidth", { configurable: true, value: 480 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 400 });
    key("+"); expect(viewport).toHaveAttribute("data-canvas-zoom", "1.1");
    key("-"); expect(viewport).toHaveAttribute("data-canvas-zoom", "1");
    key("ArrowLeft", true); await waitFor(() => expect(viewport).toHaveAttribute("data-canvas-zoom", "0.5"));
    key("ArrowRight", true); await waitFor(() => expect(viewport).toHaveAttribute("data-canvas-zoom", "0.625"));
    key("ArrowUp", true); await waitFor(() => expect(viewport).toHaveAttribute("data-canvas-zoom", "0.5"));
    key("ArrowDown", true); expect(viewport).toHaveAttribute("data-canvas-zoom", "1");
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("leaves panning unbound, prevents browser-native arrow scrolling, and uses assigned directions", () => {
    const view = setup(); let viewport = screen.getByLabelText("Canvas viewport");
    viewport.scrollTop = 50;
    expect(fireEvent.keyDown(viewport, { key: "ArrowDown" })).toBe(false);
    expect(viewport.scrollTop).toBe(50);
    view.unmount(); localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ "viewport.panDown": "j", "viewport.panRight": "k" }));
    setup(); viewport = screen.getByLabelText("Canvas viewport");
    key("j"); key("k"); expect(viewport.scrollTop).toBe(40); expect(viewport.scrollLeft).toBe(40);
    expect(store.getState().encounter.past).toHaveLength(0);
  });
  it("opens Library once, ignores inputs/modals, and controls all audio", () => {
    const view = setup(); key("l"); expect(view.open).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "l", repeat: true }); expect(view.open).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "l" }); expect(view.open).toHaveBeenCalledTimes(1);
    key("p"); expect(audio.pauseAll).not.toHaveBeenCalled(); expect(audio.resumeAll).not.toHaveBeenCalled();
    audio.hasRunningPlayback = true; key("p"); expect(audio.pauseAll).toHaveBeenCalledTimes(1);
    audio.hasRunningPlayback = false; audio.hasPausedPlayback = true; key("p"); expect(audio.resumeAll).toHaveBeenCalledTimes(1);
    const modal = document.createElement("div"); modal.setAttribute("aria-modal", "true"); document.body.append(modal);
    key("l"); key("p"); expect(view.open).toHaveBeenCalledTimes(1); expect(audio.resumeAll).toHaveBeenCalledTimes(1); modal.remove();
  });
});
