import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import {
  createCircleZone,
  createHexagonZone,
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool,
  startPolygonMode
} from "@tests/ui/renderApp";

describe("CanvasShell zone creation", () => {
  it("creates rectangle zones by default, circle zones with keybind 2, and hexagon zones with keybind 3", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);

    expect(screen.getByText("Zone shape: rectangle")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();

    createRectangleZone(canvas);

    expect(
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();

    const rectangleZone = await screen.findByLabelText("Zone 1");

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [rectangleZone.getAttribute("data-entity-id")]
    });
    expect(screen.getByDisplayValue("Zone 1")).toBeInTheDocument();
    expect(rectangleZone.getAttribute("points")?.split(" ")).toHaveLength(4);

    createCircleZone(canvas);
    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();
    expect((await screen.findByLabelText("Zone 2")).getAttribute("points")?.split(" ")).toHaveLength(60);

    createHexagonZone(canvas, { x: 420, y: 100 }, { x: 520, y: 200 });
    expect(screen.getByText("Zone shape: hexagon")).toBeInTheDocument();
    expect((await screen.findByLabelText("Zone 3")).getAttribute("points")?.split(" ")).toHaveLength(6);
  });

  it("creates a polygon zone from sequential Zone Tool points", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    startPolygonMode();

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });
    fireEvent.doubleClick(canvas, { clientX: 220, clientY: 220 });

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();
  });

  it("selects newly created zones without expanding a collapsed properties panel", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await user.click(
      screen.getByRole("button", { name: "Collapse Properties panel" })
    );
    await selectZoneTool(user);

    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
    expect(
      screen.getByRole("button", { name: "Expand Properties panel" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByDisplayValue("Zone 1")).not.toBeInTheDocument();
  });

  it("prevents creating a zone on top of an existing zone", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 100, y: 100 }, { x: 200, y: 200 });

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();

    createRectangleZone(canvas, { x: 150, y: 150 }, { x: 240, y: 240 });

    expect(screen.queryByLabelText("Zone 2")).not.toBeInTheDocument();
    expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
  });

  it("shows an undersized shape draft in red and does not create it", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: 100,
      clientY: 100
    });
    fireEvent.mouseMove(canvas, { clientX: 140, clientY: 140 });

    expect(screen.getByLabelText("rectangle zone draft")).toHaveClass(
      "fill-red-200/60"
    );

    fireEvent.mouseUp(canvas);

    expect(screen.queryByLabelText("Zone 1")).not.toBeInTheDocument();
    expect(store.getState().encounter.present.zones.allIds).toHaveLength(0);
  });

  it("maps zone creation points correctly when the SVG viewport is letterboxed", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas, { right: 1200, width: 1200 });

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 220, y: 100 }, { x: 320, y: 200 });

    expect(await screen.findByLabelText("Zone 1")).toHaveAttribute(
      "points",
      "100,100 200,100 200,200 100,200"
    );
  });

  it("clones selected zone properties when ctrl-dragging a new zone", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");
    const firstZoneId = firstZone.getAttribute("data-entity-id") ?? "";

    fireEvent.click(firstZone, { clientX: 120, clientY: 120 });
    await user.click(screen.getByRole("button", { name: "Fill color #bfdbfe" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.45" }
    });
    await user.click(screen.getByRole("checkbox", { name: /Show name/ }));
    await user.click(screen.getByRole("radio", { name: "Bottom right" }));
    await user.selectOptions(screen.getByLabelText("Layout strategy"), [
      "SPLIT_FLEX"
    ]);
    fireEvent.change(screen.getByLabelText("Layout orientation"), {
      target: { value: "TOP_BOTTOM" }
    });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "hazard, upper" }
    });
    fireEvent.blur(screen.getByLabelText("Tags"));

    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: 260,
      clientY: 80,
      ctrlKey: true
    });
    fireEvent.mouseMove(canvas, { clientX: 360, clientY: 160, ctrlKey: true });
    fireEvent.mouseUp(canvas);

    const secondZone = await screen.findByLabelText("Zone 2");
    const secondZoneId = secondZone.getAttribute("data-entity-id") ?? "";
    const zones = store.getState().encounter.present.zones.byId;

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [secondZoneId]
    });
    expect(zones[firstZoneId].name).toBe("Zone 1");
    expect(zones[secondZoneId]).toMatchObject({
      colorFill: "#bfdbfe",
      layoutOrientation: "TOP_BOTTOM",
      layoutStrategy: "SPLIT_FLEX",
      name: "Zone 2",
      namePosition: "bottom-right",
      opacity: 0.45,
      shape: "rectangle",
      showName: true,
      tags: ["hazard", "upper"]
    });
  });
});
