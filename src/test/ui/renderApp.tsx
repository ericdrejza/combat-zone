import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { resetInteractionState } from "../../interaction/interactionState";
import { resetEncounterState } from "../../store/encounterSlice";
import { store } from "../../store/store";
import { App } from "../../ui/App";

export function resetAppStore() {
  store.dispatch(resetEncounterState());
  store.dispatch(resetInteractionState());
}

export function renderApp(): RenderResult {
  resetAppStore();

  return render(
    <Provider store={store}>
      <App />
    </Provider>
  );
}

export function mockCanvasBounds(
  canvas: HTMLElement,
  bounds: Partial<DOMRect> = {}
) {
  canvas.getBoundingClientRect = () => ({
    bottom: bounds.bottom ?? 640,
    height: bounds.height ?? 640,
    left: bounds.left ?? 0,
    right: bounds.right ?? 960,
    toJSON() {},
    top: bounds.top ?? 0,
    width: bounds.width ?? 960,
    x: bounds.x ?? 0,
    y: bounds.y ?? 0
  });
}

export function getCanvas(): HTMLElement {
  return screen.getByLabelText("SVG encounter workspace");
}

export async function selectZoneTool(
  user: ReturnType<typeof userEvent.setup>
) {
  await user.click(screen.getByRole("button", { name: "Zone" }));
}

export function createRectangleZone(
  canvas: HTMLElement,
  start = { x: 80, y: 80 },
  end = { x: 180, y: 160 }
) {
  fireEvent.mouseDown(canvas, {
    button: 0,
    clientX: start.x,
    clientY: start.y
  });
  fireEvent.mouseMove(canvas, { clientX: end.x, clientY: end.y });
  fireEvent.mouseUp(canvas);
}

export function createCircleZone(
  canvas: HTMLElement,
  start = { x: 240, y: 100 },
  end = { x: 340, y: 200 }
) {
  fireEvent.keyDown(window, { key: "2" });
  createRectangleZone(canvas, start, end);
}

export function createHexagonZone(
  canvas: HTMLElement,
  start = { x: 240, y: 100 },
  end = { x: 340, y: 200 }
) {
  fireEvent.keyDown(window, { key: "3" });
  createRectangleZone(canvas, start, end);
}

export function startPolygonMode() {
  fireEvent.keyDown(window, { key: "4" });
}
