import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@test/ui/renderApp";

describe("CanvasShell zone dragging", () => {
  it("selects and drags an existing zone in Zone mode instead of drawing over it", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 120, y: 120 }, { x: 220, y: 200 });

    const zone = await screen.findByLabelText("Zone 1");
    const beforePoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 130, clientY: 130 });
    fireEvent.mouseMove(canvas, { clientX: 170, clientY: 150 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
    expect(zone.getAttribute("points")).not.toEqual(beforePoints);
    expect(screen.queryByLabelText("rectangle zone draft")).not.toBeInTheDocument();
  });

  it("rejects zone moves that would drop vertices off screen", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const originalPoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: -80, clientY: -80 });
    fireEvent.mouseUp(canvas);

    expect(zone).toHaveAttribute("points", originalPoints ?? "");
  });

  it("prevents dropping an existing zone onto another zone", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 80, y: 80 }, { x: 160, y: 160 });
    createRectangleZone(canvas, { x: 260, y: 80 }, { x: 340, y: 160 });

    const zone = await screen.findByLabelText("Zone 2");
    const beforePoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 300, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(canvas);

    expect(zone.getAttribute("points")).toEqual(beforePoints);
  });
});
