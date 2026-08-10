import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { commitEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import {
  getCenteredCanvasResizeScroll,
  getCenteredZoomScroll,
  getZoomToFit
} from "@ui/canvas/canvasViewportMath";
import { renderApp } from "@tests/ui/renderApp";

describe("canvas viewport navigation", () => {
  it("calculates fit zoom and center-preserving scroll positions", () => {
    expect(
      getZoomToFit(
        { height: 640, width: 960 },
        { height: 320, width: 600 }
      )
    ).toBe(0.5);
    expect(
      getCenteredZoomScroll({
        canvasSize: { height: 640, width: 960 },
        currentZoom: 1,
        nextZoom: 2,
        scrollLeft: 100,
        scrollTop: 80,
        viewportSize: { height: 320, width: 600 }
      })
    ).toEqual({ left: 500, top: 320 });
    expect(
      getCenteredCanvasResizeScroll({
        currentCanvasSize: { height: 800, width: 1000 },
        nextCanvasSize: { height: 1600, width: 2000 },
        scrollLeft: 300,
        scrollTop: 250,
        viewportSize: { height: 300, width: 400 },
        zoom: 1
      })
    ).toEqual({ left: 800, top: 650 });
  });

  it("orders controls, changes perception only, and toggles panning", async () => {
    const user = userEvent.setup();
    renderApp();
    const navigation = screen.getByLabelText("Canvas navigation");
    const buttons = within(navigation).getAllByRole("button");

    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Zoom to fit",
      "Zoom out",
      "Zoom in",
      "Reset zoom",
      "Pan with right drag"
    ]);
    const historyLength = store.getState().encounter.past.length;
    const viewport = screen.getByLabelText("Canvas viewport");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(viewport).toHaveAttribute("data-canvas-zoom", "1.1");
    expect(screen.getByLabelText("Current zoom")).toHaveTextContent("110%");
    expect(store.getState().encounter.past).toHaveLength(historyLength);

    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(viewport).toHaveAttribute("data-canvas-zoom", "1");
    expect(screen.getByLabelText("Current zoom")).toHaveTextContent("100%");

    const panButton = screen.getByRole("button", { name: "Pan with right drag" });
    expect(panButton).toHaveAttribute("aria-pressed", "true");
    await user.click(panButton);
    expect(panButton).toHaveAttribute("aria-pressed", "false");
  });

  it("reads the currently visible workspace when zooming to fit", async () => {
    const user = userEvent.setup();
    renderApp();
    const viewport = screen.getByLabelText("Canvas viewport");
    let height = 400;
    let width = 600;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, get: () => height },
      clientWidth: { configurable: true, get: () => width }
    });
    fireEvent(window, new Event("resize"));

    height = 800;
    width = 1000;
    await user.click(screen.getByRole("button", { name: "Zoom to fit" }));

    expect(viewport).toHaveAttribute("data-canvas-zoom", "1.042");
  });

  it("scrolls with shift-wheel, arrow keys, and enabled right drag", () => {
    renderApp();
    const viewport = screen.getByLabelText("Canvas viewport");
    viewport.scrollLeft = 100;
    viewport.scrollTop = 80;

    fireEvent.wheel(viewport, { deltaY: 30, shiftKey: true });
    expect(viewport.scrollLeft).toBe(130);

    fireEvent.keyDown(viewport, { key: "ArrowDown" });
    expect(viewport.scrollTop).toBe(120);

    fireEvent.mouseDown(viewport, { button: 2, clientX: 200, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 180, clientY: 170 });
    fireEvent.mouseUp(window, { button: 2 });
    expect(viewport.scrollLeft).toBe(150);
    expect(viewport.scrollTop).toBe(150);
  });

  it("preserves zoom and the proportionally centered point after canvas resize", async () => {
    const user = userEvent.setup();
    renderApp();
    const viewport = screen.getByLabelText("Canvas viewport");
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 400 }
    });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(viewport).toHaveAttribute("data-canvas-zoom", "1.1");
    viewport.scrollLeft = 200;
    viewport.scrollTop = 150;

    act(() => {
      const encounter = store.getState().encounter.present;
      store.dispatch(
        commitEncounterChange({
          action: createEncounterActionRecord("canvas.resize"),
          nextEncounter: {
            ...encounter,
            canvasSize: { height: 1280, width: 1920 }
          }
        })
      );
    });

    expect(viewport).toHaveAttribute("data-canvas-zoom", "1.1");
    expect(viewport.scrollLeft).toBeCloseTo(600);
    expect(viewport.scrollTop).toBeCloseTo(450);
  });
});
