import { fireEvent, screen } from "@testing-library/react";

import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";

describe("CanvasShell touch editing", () => {
  it("uses a single touch pointer for the active Zone tool", async () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 80,
      clientY: 80,
      pointerId: 1,
      pointerType: "touch"
    });
    fireEvent.pointerMove(canvas, {
      clientX: 180,
      clientY: 160,
      pointerId: 1,
      pointerType: "touch"
    });
    fireEvent.pointerUp(canvas, {
      clientX: 180,
      clientY: 160,
      pointerId: 1,
      pointerType: "touch"
    });

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();
  });

  it("does not begin an edit when the second touch starts navigation", () => {
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 40,
      clientY: 40,
      pointerId: 1,
      pointerType: "touch"
    });
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: 140,
      clientY: 140,
      pointerId: 2,
      pointerType: "touch"
    });
    fireEvent.pointerMove(canvas, {
      clientX: 180,
      clientY: 180,
      pointerId: 2,
      pointerType: "touch"
    });
    fireEvent.pointerUp(canvas, {
      clientX: 180,
      clientY: 180,
      pointerId: 2,
      pointerType: "touch"
    });
    fireEvent.pointerUp(canvas, {
      clientX: 40,
      clientY: 40,
      pointerId: 1,
      pointerType: "touch"
    });

    expect(screen.queryByLabelText("Zone 1")).not.toBeInTheDocument();
  });
});
