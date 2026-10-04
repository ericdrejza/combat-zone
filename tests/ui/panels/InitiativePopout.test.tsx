import { act, fireEvent, screen, within } from "@testing-library/react";
import { renderApp } from "@tests/ui/renderApp";
import { createActor } from "@entities/actor/actorMutations";
import { addActorsToInitiative } from "@core/encounter/initiativeMutations";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { setPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { KEYBIND_STORAGE_KEY } from "@ui/keybinds";

function mockPopup() {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const popup = frame.contentWindow!;
  const close = vi.spyOn(popup, "close").mockImplementation(() => {});
  const focus = vi.spyOn(popup, "focus").mockImplementation(() => {});
  const open = vi.spyOn(window, "open").mockReturnValue(popup);
  return { frame, popup, close, open, focus };
}

afterEach(() => { setPersistenceWritable(true); vi.restoreAllMocks(); localStorage.removeItem(KEYBIND_STORAGE_KEY); document.querySelectorAll("iframe").forEach((frame) => frame.remove()); });

describe("Initiative popout", () => {
  it("focuses the active window from the launcher and closes from the popout", () => {
    const { popup, close, open, focus } = mockPopup();
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Open Initiative window" }));
    const root = popup.document.getElementById("initiative-root")!;
    fireEvent.click(screen.getByRole("button", { name: "Focus Initiative window" }));
    expect(focus).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(popup.document.getElementById("initiative-root")).toBe(root);
    expect(screen.getByRole("button", { name: "Focus Initiative window" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(root).getByRole("button", { name: "Close Initiative window" }));
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Open Initiative window" })).toHaveAttribute("aria-pressed", "false");
  });

  it("places the launcher before the header drag control and shares history with the popup", () => {
    const { popup, close, open } = mockPopup();
    renderApp();
    const launcher = screen.getByRole("button", { name: "Open Initiative window" });
    expect(launcher.nextElementSibling).toBe(screen.getByRole("button", { name: "Reorder Initiative panel" }));
    const state = addActorsToInitiative(createActor(store.getState().encounter.present, { id: "a", name: "Alpha", currentZoneId: "zoneless" }), ["a"]);
    act(() => { store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.seed"), nextEncounter: state })); });
    fireEvent.click(launcher);
    expect(open).toHaveBeenCalledWith("", "combat-zone-initiative", expect.stringContaining("popup"));
    const root = popup.document.getElementById("initiative-root")!;
    fireEvent.keyDown(within(root).getByRole("textbox", { name: "Alpha initiative" }), { key: "i" });
    expect(screen.getByRole("button", { name: "Alpha status: Healthy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add selected actors" })).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    const guardedBefore = store.getState().encounter.present;
    setPersistenceWritable(false);
    fireEvent.click(within(root).getByRole("button", { name: "Alpha status: Healthy" }));
    fireEvent.click(within(root).getByRole("button", { name: "Set Alpha status: Dead" }));
    expect(store.getState().encounter.present).toBe(guardedBefore);
    setPersistenceWritable(true);
    fireEvent.click(within(root).getByRole("button", { name: "Alpha status: Healthy" }));
    fireEvent.click(within(root).getByRole("button", { name: "Set Alpha status: Dead" }));
    expect(store.getState().encounter.present.actors.byId.a.status).toBe(0);
    expect(screen.getByRole("button", { name: "Alpha status: Dead" })).toBeInTheDocument();
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(within(root).getByRole("button", { name: "Alpha status: Healthy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alpha status: Healthy" }));
    fireEvent.click(screen.getByRole("button", { name: "Set Alpha status: Injured" }));
    expect(within(root).getByRole("button", { name: "Alpha status: Injured" })).toBeInTheDocument();
    act(() => { store.dispatch(undoEncounterChange()); });
    fireEvent.keyDown(popup, { key: "i" });
    expect(close).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Open Initiative window" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Alpha status: Healthy" })).toBeInTheDocument();
  });

  it("toggles with I, ignores typing/repeats, and recovers after manual window closure", () => {
    const { popup, open } = mockPopup();
    renderApp();
    fireEvent.keyDown(window, { key: "i", repeat: true });
    expect(open).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "i" });
    expect(open).toHaveBeenCalledOnce();
    act(() => { popup.dispatchEvent(new Event("beforeunload")); });
    expect(screen.getByRole("button", { name: "Open Initiative window" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "i" });
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("uses a customized binding and reports popup blocking", () => {
    localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ "initiative.toggle": "j" }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderApp();
    fireEvent.keyDown(window, { key: "i" });
    expect(open).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "j" });
    expect(alert).toHaveBeenCalledWith(expect.stringContaining("popup was blocked"));
    expect(screen.getByRole("button", { name: "Open Initiative window" })).toHaveAttribute("aria-pressed", "false");
  });
});
