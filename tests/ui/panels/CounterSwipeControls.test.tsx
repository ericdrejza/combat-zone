import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { CounterControls } from "@ui/panels/status_panel/CounterControls";

const gesture = vi.hoisted(() => ({ handlers: [] as any[], start: vi.fn() }));
vi.mock("motion/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("motion/react")>();
  const { createElement } = await import("react");
  return { ...original, useDragControls: () => ({ start: gesture.start }), motion: {
    ...original.motion,
    div: ({ children, onDragEnd, onPointerDown, onPointerCancel, onClickCapture, onDragStart, drag, dragControls, dragListener, dragMomentum, style, ...rest }: any) => {
      if (onDragEnd) gesture.handlers.push({ onDragEnd, onPointerDown, onPointerCancel, onDragStart });
      return createElement("div", { ...rest, onPointerDown, onPointerCancel, onClickCapture }, children);
    },
  } };
});

const counters = { allIds: ["a", "b"], byId: { a: { id: "a", name: "Arrows", value: 3 }, b: { id: "b", name: "Bolts", value: 4 } } };
function setup(disabled = false) {
  const onSaveBatch = vi.fn();
  render(<CounterControls counters={counters} disabled={disabled} onSave={vi.fn()} onAdjust={vi.fn()} onSaveBatch={onSaveBatch} />);
  return onSaveBatch;
}
function finish(offset: number, velocity = 0, type = "pointerup") {
  act(() => gesture.handlers[1].onDragEnd({ type }, { offset: { x: offset }, velocity: { x: velocity } }));
}
beforeEach(() => { gesture.handlers = []; gesture.start.mockClear(); });

it("starts only touch drags and leaves embedded controls alone", () => {
  setup();
  const row = screen.getByRole("group", { name: "Bolts" });
  const down = gesture.handlers[1].onPointerDown;
  down({ pointerType: "mouse", target: row });
  down({ pointerType: "pen", target: row });
  down({ pointerType: "touch", target: screen.getByRole("button", { name: "Increase Bolts" }) });
  expect(gesture.start).not.toHaveBeenCalled();
  down({ pointerType: "touch", target: row });
  expect(gesture.start).toHaveBeenCalledOnce();
});
it("deletes only the swiped counter through the existing batch mutation", () => {
  const save = setup();
  finish(80);
  expect(save).toHaveBeenCalledWith([], ["b"]);
});
it("opens the editor with the swiped counter selected", () => {
  setup();
  finish(-80);
  expect(screen.getByRole("combobox", { name: "Counter to edit" })).toHaveValue("b");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("ignores incomplete, cancelled, and read-only gestures", () => {
  const save = setup(true);
  finish(80);
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("does not commit a cancelled or short gesture", () => {
  const save = setup();
  finish(10);
  finish(80, 0, "pointercancel");
  expect(save).not.toHaveBeenCalled();
});
