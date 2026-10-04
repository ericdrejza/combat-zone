import { act, fireEvent, render, screen } from "@testing-library/react";
import { createActor } from "@entities/actor/actorMutations";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { HitPointControls } from "@ui/panels/status_panel/HitPointControls";
import { REPEAT_DELAY_MS, REPEAT_INTERVAL_MS } from "@ui/controls/RepeatButton";
import { store } from "@store/store";
import { undoEncounterChange, redoEncounterChange } from "@store/encounterSlice";
import { setup } from "./counterEditorSetup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
function hold(name: string) {
  const button = screen.getByRole("button", { name });
  expect(button.title).toContain("hold to repeat");
  fireEvent.pointerDown(button, { button: 0, pointerId: 1 });
  advance(REPEAT_DELAY_MS);
  advance(REPEAT_INTERVAL_MS);
  fireEvent.pointerUp(button, { pointerId: 1 });
}
function renderHitPoints() {
  const actor = createActor(createEncounterState({ id: "hold", name: "Hold" }), { id: "a", name: "Alpha", currentZoneId: "zoneless" }).actors.byId.a;
  actor.hitPoints = { current: 10, maximum: 20 };
  const onAdjust = vi.fn();
  const onSet = vi.fn();
  render(<HitPointControls actors={[actor]} label="Hit points" disabled={false} onAdjust={onAdjust} onSet={onSet} />);
  return { onAdjust, onSet };
}

it("repeats the amount control while damage and healing remain single-click actions", () => {
  const { onAdjust } = renderHitPoints();
  hold("Increase damage or healing amount");
  expect(screen.getByLabelText("Damage or healing amount")).toHaveValue("4");
  for (const name of ["Apply damage", "Apply healing"]) {
    const button = screen.getByRole("button", { name });
    expect(button.title).not.toContain("hold to repeat");
    fireEvent.pointerDown(button, { button: 0, pointerId: 2 });
    advance(1000);
    fireEvent.pointerUp(button, { pointerId: 2 });
    expect(onAdjust).toHaveBeenCalledTimes(name === "Apply damage" ? 0 : 1);
    fireEvent.click(button);
  }
  expect(onAdjust.mock.calls).toEqual([[['a'], -4], [['a'], 4]]);
});
it("repeats both HP editor fields without committing until Save", () => {
  const { onSet } = renderHitPoints();
  fireEvent.click(screen.getByRole("button", { name: "Edit Hit points" }));
  hold("Increase maximum hit points");
  expect(screen.getByLabelText("Maximum hit points")).toHaveValue(23);
  hold("Decrease current hit points");
  expect(screen.getByLabelText("Current hit points")).toHaveValue(7);
  expect(onSet).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Current hit points"), { target: { value: "1" } });
  hold("Decrease current hit points");
  expect(screen.getByLabelText("Current hit points")).toHaveValue(0);
  expect(screen.getByRole("button", { name: "Decrease current hit points" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSet).toHaveBeenCalledWith("a", { current: 0, maximum: 23 });
});
it.each([
  ["Increase current value", "Current value", 3],
  ["Decrease minimum", "Minimum (optional)", -2],
  ["Increase maximum", "Maximum (optional)", 3],
])("repeats %s in the counter draft", (name, label, expected) => {
  setup();
  hold(name);
  expect(screen.getByLabelText(label)).toHaveValue(expected);
});

it("commits repeated counter steps through undoable history", async () => {
  setup(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  const button = screen.getByRole("button", { name: "Increase Charges" });
  await act(async () => { fireEvent.pointerDown(button, { button: 0, pointerId: 1 }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(REPEAT_DELAY_MS); });
  await act(async () => { await vi.advanceTimersByTimeAsync(REPEAT_INTERVAL_MS); });
  fireEvent.pointerUp(button, { pointerId: 1 });
  const value = () => store.getState().encounter.present.actors.byId.a.counters!.byId.c.value;
  expect(value()).toBe(3);
  act(() => store.dispatch(undoEncounterChange()));
  expect(value()).toBe(2);
  act(() => store.dispatch(redoEncounterChange()));
  expect(value()).toBe(3);
});

it("resets the HP draft to its edited maximum and commits only on Save", () => {
  const { onSet } = renderHitPoints();
  fireEvent.click(screen.getByRole("button", { name: "Edit Hit points" }));
  expect(screen.getByRole("dialog", { name: "Edit hit points" })).toBeInTheDocument();
  const reset = screen.getByRole("button", { name: "Reset current hit points to maximum" });
  fireEvent.change(screen.getByLabelText("Maximum hit points"), { target: { value: "" } });
  expect(reset).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Maximum hit points"), { target: { value: "30" } });
  fireEvent.click(reset);
  expect(screen.getByLabelText("Current hit points")).toHaveValue(30);
  expect(onSet).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onSet).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit Hit points" }));
  expect(screen.getByLabelText("Current hit points")).toHaveValue(10);
  fireEvent.click(screen.getByRole("button", { name: "Reset current hit points to maximum" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onSet).toHaveBeenCalledWith("a", { current: 20, maximum: 20 });
});
