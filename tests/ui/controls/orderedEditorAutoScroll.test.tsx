import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOrderedEditorAutoScroll } from "@ui/controls/useOrderedEditorAutoScroll";

const animation = vi.hoisted(() => ({ tick: (_time: number, _elapsed: number) => {} }));
vi.mock("motion/react", () => ({ useAnimationFrame: (callback: typeof animation.tick) => { animation.tick = callback; } }));

function setup() {
  const reordered = vi.fn();
  let control!: ReturnType<typeof useOrderedEditorAutoScroll>;
  function Harness({ disabled = false }: { disabled?: boolean }) {
    const [ids, setIds] = useState(() => Array.from({ length: 12 }, (_, i) => String(i)));
    control = useOrderedEditorAutoScroll(ids, next => { reordered(next); setIds(next); }, disabled);
    return <ol ref={control.listRef} aria-label="Items">{ids.map(id => <li key={id} data-order-id={id}>
      <button type="button" onPointerDown={event => control.prepare(id, event)}>Drag {id}</button>
    </li>)}</ol>;
  }
  const view = render(<Harness />);
  const list = screen.getByRole("list") as HTMLOListElement;
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600, configurable: true } });
  list.getBoundingClientRect = () => ({ left: 0, right: 200, top: 100, bottom: 300, width: 200, height: 200 }) as DOMRect;
  for (const row of Array.from(list.children) as HTMLElement[]) {
    Object.defineProperties(row, { offsetTop: { get: () => Array.from(list.children).indexOf(row) * 50 }, offsetHeight: { value: 48 } });
    row.getBoundingClientRect = () => ({ top: 100 + row.offsetTop - list.scrollTop, height: 48 }) as DOMRect;
  }
  list.scrollTop = 200;
  function prepare() { fireEvent.pointerDown(screen.getByRole("button", { name: "Drag 4" }), { button: 0, pointerId: 1, clientX: 30, clientY: 124 }); }
  function start() { prepare(); control.start(); }
  return { ...view, list, start, prepare, reordered, disable: () => view.rerender(<Harness disabled />) };
}
function pointer(type: string, x = 30, y = 299, pointerId = 1) {
  const event = new Event(type, { bubbles: true }); Object.assign(event, { clientX: x, clientY: y, pointerId });
  act(() => { window.dispatchEvent(event); });
}
const tick = (count = 1) => { for (let i = 0; i < count; i++) act(() => animation.tick(i * 16.7, 1000 / 60)); };

describe("ordered editor edge scrolling", () => {
  it("continuously scrolls and reorders hidden rows under a stationary pointer at either edge", () => {
    const { list, start, reordered } = setup(); start(); pointer("pointermove");
    tick(); const initial = list.scrollTop; expect(initial).toBeGreaterThan(200);
    Object.defineProperty(list, "scrollHeight", { value: 1200, configurable: true });
    tick(30); expect(list.scrollTop).toBe(400);
    expect(Array.from(list.children).at(-1)).toHaveAttribute("data-order-id", "4");
    expect(reordered).toHaveBeenCalled();
    pointer("pointermove", 30, 101); tick(40);
    expect(list.scrollTop).toBe(0);
    expect(list.firstElementChild).toHaveAttribute("data-order-id", "4");
  });
  it("does not scroll for mere handle presses, in the middle, or away from this list", () => {
    const first = setup(); first.prepare(); pointer("pointermove"); tick(); expect(first.list.scrollTop).toBe(200); first.unmount();
    // Motion calls start only after the gesture passes its drag threshold.
    const view = setup(); view.start();
    for (const [x, y] of [[30, 200], [250, 299], [30, 400]]) {
      pointer("pointermove", x, y); tick(); expect(view.list.scrollTop).toBe(200);
    }
  });
  it.each(["pointerup", "pointercancel", "blur"])("stops immediately on %s", type => {
    const { list, start } = setup(); start(); pointer("pointermove"); tick();
    const stopped = list.scrollTop; pointer(type); tick(5); expect(list.scrollTop).toBe(stopped);
  });
  it("ignores other pointers and stops on disable or unmount", () => {
    const { list, start, disable, unmount } = setup(); start(); pointer("pointermove");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Drag 5" }), { button: 0, pointerId: 2, clientX: 30, clientY: 101 });
    pointer("pointermove", 30, 101, 2); pointer("pointerup", 30, 101, 2); tick(); expect(list.scrollTop).toBeGreaterThan(200);
    disable(); const stopped = list.scrollTop; tick(3); expect(list.scrollTop).toBe(stopped);
    unmount(); pointer("pointermove"); tick(); expect(list.scrollTop).toBe(stopped);
  });
});
