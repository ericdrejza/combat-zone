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
  selectZoneTool
} from "@tests/ui/renderApp";

describe("CanvasShell zone resizing", () => {
  it("resizes rectangle zones with connected corners instead of moving one vertex", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const topRightHandle = screen.getByLabelText("Zone 1 vertex 2");

    fireEvent.mouseDown(topRightHandle, { button: 0, clientX: 180, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 220, clientY: 60 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 220, clientY: 60 });

    expect(zone.getAttribute("points")).toBe("80,60 220,60 220,160 80,160");
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
  });

  it("can resize repeatedly from the same selected-zone vertex", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    fireEvent.mouseDown(screen.getByLabelText("Zone 1 vertex 2"), {
      button: 0,
      clientX: 180,
      clientY: 80
    });
    fireEvent.mouseMove(window, { clientX: 220, clientY: 60 });
    fireEvent.mouseUp(window, { clientX: 220, clientY: 60 });

    const sameVertex = screen.getByLabelText("Zone 1 vertex 2");

    expect(sameVertex).toHaveAttribute("data-drag-snap-to-origin", "true");

    fireEvent.mouseDown(sameVertex, {
      button: 0,
      clientX: 220,
      clientY: 60
    });
    fireEvent.mouseMove(window, { clientX: 250, clientY: 50 });
    fireEvent.mouseUp(window, { clientX: 250, clientY: 50 });

    expect(zone).toHaveAttribute(
      "points",
      "80,50 250,50 250,160 80,160"
    );
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
  });

  it("rejects zone resizes that would drop vertices off screen", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const originalPoints = zone.getAttribute("points");
    const topLeftHandle = screen.getByLabelText("Zone 1 vertex 1");

    fireEvent.mouseDown(topLeftHandle, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: -20, clientY: -20 });
    fireEvent.mouseUp(canvas);

    expect(zone).toHaveAttribute("points", originalPoints ?? "");
  });

  it("shows eight circle resize handles while storing the circle as polygon geometry", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createCircleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(60);
    expect(screen.getAllByLabelText(/Zone 1 vertex/)).toHaveLength(8);
  });

  it("shows eight hexagon resize handles while storing the hexagon as six polygon segments", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createHexagonZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(screen.getAllByLabelText(/Zone 1 vertex/)).toHaveLength(8);
  });

  it("keeps hexagon zones selected after resizing from orthogonal and top-left bounds handles", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createHexagonZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const handles = [
      { label: "Zone 1 vertex 3", move: { x: 390, y: 150 }, start: { x: 340, y: 150 } },
      { label: "Zone 1 vertex 7", move: { x: 210, y: 150 }, start: { x: 240, y: 150 } },
      { label: "Zone 1 vertex 1", move: { x: 300, y: 80 }, start: { x: 300, y: 100 } },
      { label: "Zone 1 vertex 5", move: { x: 300, y: 230 }, start: { x: 300, y: 200 } },
      { label: "Zone 1 vertex 8", move: { x: 190, y: 60 }, start: { x: 210, y: 80 } }
    ];

    let previousPoints = zone.getAttribute("points");

    handles.forEach(({ label, move, start }) => {
      fireEvent.mouseDown(screen.getByLabelText(label), {
        button: 0,
        clientX: start.x,
        clientY: start.y
      });
      fireEvent.mouseMove(canvas, { clientX: move.x, clientY: move.y });
      fireEvent.mouseUp(canvas);
      fireEvent.click(canvas, { clientX: move.x, clientY: move.y });

      expect(zone.getAttribute("points")).not.toBe(previousPoints);
      expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
      expect(store.getState().interaction.selection).toMatchObject({
        selectedEntityType: "zone",
        selectedIds: [zone.getAttribute("data-entity-id")]
      });

      previousPoints = zone.getAttribute("points");
    });
  });

  it("resizes circle zones from corner handles without preserving aspect ratio", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createCircleZone(canvas);

    fireEvent.mouseDown(screen.getByLabelText("Zone 1 vertex 2"), {
      button: 0,
      clientX: 340,
      clientY: 100
    });
    fireEvent.mouseMove(canvas, { clientX: 380, clientY: 80 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 380, clientY: 80 });

    const selectedZoneId =
      store.getState().interaction.selection.selectedIds[0] ?? "";
    const polygon =
      store.getState().encounter.present.zones.byId[selectedZoneId]?.polygon ??
      [];
    const xValues = polygon.map((point) => point.x);
    const yValues = polygon.map((point) => point.y);

    expect(Math.min(...xValues)).toBeCloseTo(240);
    expect(Math.max(...xValues)).toBeCloseTo(380);
    expect(Math.min(...yValues)).toBeCloseTo(80);
    expect(Math.max(...yValues)).toBeCloseTo(200);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [selectedZoneId]
    });
  });
});
