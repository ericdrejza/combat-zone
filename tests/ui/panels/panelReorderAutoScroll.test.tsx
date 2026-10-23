import { act, fireEvent, renderHook } from "@testing-library/react";
import { usePanelReorderAutoScroll } from "@ui/panels/usePanelReorderAutoScroll";

const animation = vi.hoisted(() => ({ tick: (_time: number, _elapsed: number) => {} }));
vi.mock("motion/react", () => ({
  useAnimationFrame: (callback: typeof animation.tick) => { animation.tick = callback; }
}));

function setup() {
  const preview = vi.fn();
  const hook = renderHook(({ active }) => usePanelReorderAutoScroll(active, preview), {
    initialProps: { active: true }
  });
  const list = document.createElement("div");
  Object.defineProperties(list, {
    clientHeight: { value: 200 },
    scrollHeight: { value: 600 }
  });
  list.scrollTop = 200;
  list.getBoundingClientRect = () => ({ left: 0, right: 288, top: 100, bottom: 300 }) as DOMRect;
  hook.result.current.current = list;
  return { ...hook, list, preview };
}

const tick = () => act(() => animation.tick(100, 1000 / 60));

it("scrolls repeatedly at either edge without further pointer movement and clamps to available content", () => {
  const { list } = setup();
  fireEvent.pointerMove(window, { clientX: 100, clientY: 299 });
  tick();
  const first = list.scrollTop;
  expect(first).toBeGreaterThan(200);
  tick();
  expect(list.scrollTop).toBeGreaterThan(first);
  list.scrollTop = 399;
  tick();
  expect(list.scrollTop).toBe(400);
  tick();
  expect(list.scrollTop).toBe(400);
  fireEvent.pointerMove(window, { clientX: 100, clientY: 101 });
  tick();
  expect(list.scrollTop).toBeLessThan(400);
  list.scrollTop = 1;
  tick();
  expect(list.scrollTop).toBe(0);
  tick();
  expect(list.scrollTop).toBe(0);
});

it("stops away from edges, outside the dock, after cancellation, and when no panel is dragged", () => {
  const { list, rerender } = setup();
  for (const point of [{ clientX: 100, clientY: 200 }, { clientX: 400, clientY: 299 }, { clientX: 100, clientY: 350 }]) {
    fireEvent.pointerMove(window, point);
    tick();
    expect(list.scrollTop).toBe(200);
  }
  fireEvent.pointerMove(window, { clientX: 100, clientY: 299 });
  fireEvent.pointerCancel(window);
  tick();
  expect(list.scrollTop).toBe(200);
  fireEvent.pointerMove(window, { clientX: 100, clientY: 299 });
  rerender({ active: false });
  tick();
  expect(list.scrollTop).toBe(200);
});

it("handles native dragover in capture phase and stops after a drop", () => {
  const { list } = setup();
  const child = document.createElement("div");
  document.body.append(child);
  child.addEventListener("dragover", event => event.stopPropagation());
  fireEvent(child, new MouseEvent("dragover", { bubbles: true, clientX: 100, clientY: 299 }));
  tick();
  expect(list.scrollTop).toBeGreaterThan(200);
  const scrolled = list.scrollTop;
  fireEvent.drop(child);
  tick();
  expect(list.scrollTop).toBe(scrolled);
  child.remove();
});

it("refreshes the insertion target revealed by scrolling under a stationary pointer", () => {
  const { list, preview } = setup();
  const target = document.createElement("div");
  target.dataset.panelDropSide = "right";
  target.dataset.panelDropKind = "marker";
  target.dataset.panelDropIndex = "2";
  const original = document.elementFromPoint;
  document.elementFromPoint = vi.fn(() => target);
  try {
    fireEvent.pointerMove(window, { clientX: 100, clientY: 299 });
    tick();
    expect(preview).toHaveBeenLastCalledWith({ side: "right", index: 2 });
    target.dataset.panelDropIndex = "3";
    tick();
    expect(list.scrollTop).toBeGreaterThan(200);
    expect(preview).toHaveBeenLastCalledWith({ side: "right", index: 3 });
  } finally {
    document.elementFromPoint = original;
  }
});
