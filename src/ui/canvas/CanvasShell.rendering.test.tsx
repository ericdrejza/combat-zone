import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { RENDER_LAYERS } from "../../core/rendering/types";
import {
  createCircleZone,
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool,
  startPolygonMode
} from "../../test/ui/renderApp";

describe("CanvasShell rendering", () => {
  it("renders canvas layers in documented order without placeholder overlays", () => {
    const { container } = renderApp();
    const layerIds = Array.from(container.querySelectorAll("[data-layer]")).map(
      (layer) => layer.getAttribute("data-layer")
    );

    expect(layerIds).toEqual(RENDER_LAYERS.map((layer) => layer.id));
    expect(
      screen.queryByLabelText("Selection overlay placeholder")
    ).not.toBeInTheDocument();
  });

  it("uses background luminance for circle zone name text even with opaque fill", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createCircleZone(canvas);

    await screen.findByLabelText("Zone 1");
    await user.click(screen.getByRole("button", { name: "Fill color #991b1b" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "1" }
    });
    await user.click(screen.getByRole("checkbox", { name: /Show name/ }));

    await waitFor(() => {
      const zoneNameText = Array.from(canvas.querySelectorAll("text")).find(
        (element) => element.textContent === "Zone 1"
      );

      expect(zoneNameText).toHaveAttribute("fill", "#111827");
    });
  });

  it("does not render foreignObject zone contents for any zone shape", async () => {
    const user = userEvent.setup();

    const { container } = renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 120, y: 120 });
    createCircleZone(canvas, { x: 180, y: 40 }, { x: 260, y: 120 });
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 320, clientY: 40 });
    fireEvent.click(canvas, { clientX: 440, clientY: 40 });
    fireEvent.doubleClick(canvas, { clientX: 440, clientY: 160 });

    expect(await screen.findByLabelText("Zone 3")).toBeInTheDocument();
    expect(container.querySelector("foreignObject")).toBeNull();
  });
});
