import { act, fireEvent, render, screen } from "@testing-library/react";
import { KeybindProvider, KEYBIND_STORAGE_KEY } from "@ui/keybinds";
import { KeybindSettings } from "@ui/settings/KeybindSettings";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { bindingsConflict, keybindFromEvent, matchesKeybind } from "@ui/keybinds/keybindDefinitions";

beforeEach(() => localStorage.clear());
function setup() { return render(<KeybindProvider><KeybindSettings /></KeybindProvider>); }
function assign(label: string, key: string, extra: KeyboardEventInit = {}) {
  const button = screen.getByRole("button", { name: `Change ${label} keybind` }); fireEvent.click(button); fireEvent.keyDown(button, { key, ...extra });
}

describe("keybind conflicts and presets", () => {
  it("confirms a conflict before unbinding the displaced action", () => {
    setup(); assign("Open Library", "p");
    expect(screen.getByRole("dialog", { name: "Override conflicting keybinds?" })).toHaveTextContent("Play/Pause all audio");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("Press key");
    assign("Open Library", "p"); fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("P");
    expect(screen.getByRole("button", { name: "Change Play/Pause all audio keybind" })).toHaveTextContent("Unassigned");
    expect(JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!)).toMatchObject({ "library.open": "p", "audio.toggle": "" });
  });
  it("applies arrow pan preset atomically and restores defaults", () => {
    const view = setup(); fireEvent.click(screen.getByRole("button", { name: "Arrow keys" }));
    expect(screen.getByRole("button", { name: "Change Pan up keybind" })).toHaveTextContent("—");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const stored = JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY)!);
    expect(stored).toMatchObject({ "viewport.panUp": "arrowup", "viewport.panDown": "arrowdown", "viewport.panLeft": "arrowleft", "viewport.panRight": "arrowright", "actor.moveUp": "", "actor.moveDown": "", "actor.moveLeft": "", "actor.moveRight": "" });
    view.unmount(); setup(); expect(screen.getByRole("button", { name: "Change Pan up keybind" })).toHaveTextContent("↑");
    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    expect(screen.getByRole("button", { name: "Change Pan up keybind" })).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Change Move actors up keybind" })).toHaveTextContent("↑");
  });
  it("cancels WASD without changing conflicting shortcuts", () => {
    setup(); fireEvent.click(screen.getByRole("button", { name: "WASD" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Change Pan up keybind" })).toHaveTextContent("—");
    expect(localStorage.getItem(KEYBIND_STORAGE_KEY)).toBeNull();
  });
  it("protects fixed shortcuts, supports clear and modifiers, and cancels recording", () => {
    setup(); assign("Open Library", "c", { ctrlKey: true });
    expect(screen.getByRole("alert")).toHaveTextContent("reserved");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    assign("Open Library", "j", { altKey: true }); expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("Alt + J");
    fireEvent.click(screen.getByRole("button", { name: "Clear Open Library keybind" }));
    expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("Unassigned");
    assign("Open Library", "Escape"); expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("Unassigned");
  });
  it("keeps legacy custom letters ahead of new defaults and resets preferences", () => {
    localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ "tool.actor": "l" })); setup();
    expect(screen.getByRole("button", { name: "Change Activate Actor tool keybind" })).toHaveTextContent("L");
    expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("Unassigned");
    act(() => window.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("button", { name: "Change Open Library keybind" })).toHaveTextContent("L");
  });
  it("matches punctuation/numpad, arrows, explicit Ctrl, and portable Mod chords", () => {
    expect(keybindFromEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", ctrlKey: true }))).toBe("ctrl+arrowleft");
    expect(matchesKeybind(new KeyboardEvent("keydown", { key: "+", shiftKey: true }), "shift+plus")).toBe(true);
    expect(matchesKeybind(new KeyboardEvent("keydown", { key: "+", code: "NumpadAdd" }), "plus")).toBe(true);
    expect(matchesKeybind(new KeyboardEvent("keydown", { key: "_", shiftKey: true }), "shift+minus")).toBe(true);
    expect(matchesKeybind(new KeyboardEvent("keydown", { key: "c", metaKey: true }), "mod+c")).toBe(true);
    expect(bindingsConflict("ctrl+c", "mod+c")).toBe(true);
    expect(bindingsConflict("", "")).toBe(false);
  });
});
