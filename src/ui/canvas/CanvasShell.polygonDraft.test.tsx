import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool,
  startPolygonMode
} from "../../test/ui/renderApp";

describe("CanvasShell polygon draft", () => {
  it("clears polygon draft points with Escape", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });

    expect(screen.getByLabelText("Zone draft")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByLabelText("Zone draft")).not.toBeInTheDocument();
  });

  it("uses background luminance for polygon draft line and vertex colors", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });

    const draft = screen.getByLabelText("Zone draft");
    const draftLine = draft.querySelector("polyline");
    const draftVertices = draft.querySelectorAll("circle");

    expect(draftLine).toHaveAttribute("stroke", "#111827");
    expect(draftVertices).toHaveLength(2);
    draftVertices.forEach((vertex) => {
      expect(vertex).toHaveAttribute("fill", "#111827");
    });
  });

  it("removes the last polygon draft point with right click", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });
    fireEvent.contextMenu(canvas, { clientX: 220, clientY: 100 });
    fireEvent.doubleClick(canvas, { clientX: 220, clientY: 220 });

    expect(screen.queryByLabelText("Zone 1")).not.toBeInTheDocument();
  });
});
