import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clearSelection, setActiveTool } from "@interaction/interactionState";
import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp,
  selectZoneTool
} from "@tests/ui/renderApp";

describe("CanvasShell zone selection", () => {
  it("selects canvas entities through the active tool interaction contract", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    act(() => {
      store.dispatch(clearSelection());
      store.dispatch(setActiveTool("select"));
    });
    fireEvent.click(zone, { clientX: 120, clientY: 120 });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
  });

  it("shows clicked Zone Tool zone details in the properties panel", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    act(() => {
      store.dispatch(clearSelection());
      fireEvent.click(zone, { clientX: 120, clientY: 120 });
    });

    const selectedZoneId = zone.getAttribute("data-entity-id") ?? "";
    const selectedZone =
      store.getState().encounter.present.zones.byId[selectedZoneId];

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [selectedZoneId]
    });
    expect(selectedZone).toBeDefined();
    expect(await screen.findByDisplayValue(selectedZone?.name ?? "")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete zone" })).toBeInTheDocument();
  });

  it("shows selected zone names and tags in the canvas status badge", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 140, y: 140 });

    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "hazard, upper" }
    });
    fireEvent.blur(screen.getByLabelText("Tags"));

    createRectangleZone(canvas, { x: 220, y: 40 }, { x: 320, y: 140 });
    fireEvent.change(screen.getByLabelText("Tags"), {
      target: { value: "cover" }
    });
    fireEvent.blur(screen.getByLabelText("Tags"));

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");

    fireEvent.click(firstZone, {
      clientX: 80,
      clientY: 80,
      ctrlKey: true
    });

    expect(
      screen.getByText("Zone 2: cover; Zone 1: hazard, upper")
    ).toBeInTheDocument();
  });

  it("unselects selected entities when clicking blank canvas", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone"
    });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 260, clientY: 260 });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: null,
      selectedIds: []
    });
  });

  it("supports ctrl-click, shift-drag, and ctrl-a multi-select", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 100, y: 100 });
    createRectangleZone(canvas, { x: 160, y: 40 }, { x: 220, y: 100 });
    createRectangleZone(canvas, { x: 300, y: 40 }, { x: 360, y: 100 });

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");
    const thirdZone = await screen.findByLabelText("Zone 3");
    const firstZoneId = firstZone.getAttribute("data-entity-id") ?? "";
    const secondZoneId = secondZone.getAttribute("data-entity-id") ?? "";
    const thirdZoneId = thirdZone.getAttribute("data-entity-id") ?? "";

    fireEvent.click(firstZone, { clientX: 60, clientY: 60 });
    fireEvent.click(secondZone, {
      clientX: 180,
      clientY: 60,
      ctrlKey: true
    });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [firstZoneId, secondZoneId]
    });

    fireEvent.mouseDown(canvas, {
      button: 0,
      clientX: 20,
      clientY: 20,
      shiftKey: true
    });
    fireEvent.mouseMove(canvas, { clientX: 240, clientY: 120 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId
    ]);

    fireEvent.keyDown(window, { ctrlKey: true, key: "a" });

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId,
      thirdZoneId
    ]);
    expect(screen.getByDisplayValue("Zone 1")).toBeInTheDocument();
  });

  it("tabs through zones by horizontal position then vertical position", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 300, y: 160 }, { x: 360, y: 220 });
    createRectangleZone(canvas, { x: 100, y: 240 }, { x: 160, y: 300 });
    createRectangleZone(canvas, { x: 100, y: 80 }, { x: 160, y: 140 });

    const rightZone = await screen.findByLabelText("Zone 1");
    const lowerLeftZone = await screen.findByLabelText("Zone 2");
    const upperLeftZone = await screen.findByLabelText("Zone 3");
    const rightZoneId = rightZone.getAttribute("data-entity-id") ?? "";
    const lowerLeftZoneId = lowerLeftZone.getAttribute("data-entity-id") ?? "";
    const upperLeftZoneId = upperLeftZone.getAttribute("data-entity-id") ?? "";

    fireEvent.mouseDown(upperLeftZone, { button: 0, clientX: 120, clientY: 100 });
    fireEvent.mouseUp(canvas);

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      upperLeftZoneId
    ]);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(store.getState().interaction.selection.selectedIds).toEqual([
      lowerLeftZoneId
    ]);

    fireEvent.keyDown(window, { key: "Tab" });
    expect(store.getState().interaction.selection.selectedIds).toEqual([
      rightZoneId
    ]);

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(store.getState().interaction.selection.selectedIds).toEqual([
      lowerLeftZoneId
    ]);
  });

  it("keeps multi-selected zones selected when modifier-clicking empty canvas", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas, { x: 40, y: 40 }, { x: 100, y: 100 });
    createRectangleZone(canvas, { x: 160, y: 40 }, { x: 220, y: 100 });

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");
    const firstZoneId = firstZone.getAttribute("data-entity-id") ?? "";
    const secondZoneId = secondZone.getAttribute("data-entity-id") ?? "";

    fireEvent.click(firstZone, { clientX: 60, clientY: 60 });
    fireEvent.click(secondZone, {
      clientX: 180,
      clientY: 60,
      ctrlKey: true
    });

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId
    ]);

    fireEvent.click(canvas, { clientX: 500, clientY: 300, ctrlKey: true });

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId
    ]);

    fireEvent.click(canvas, { clientX: 520, clientY: 320, shiftKey: true });

    expect(store.getState().interaction.selection.selectedIds).toEqual([
      firstZoneId,
      secondZoneId
    ]);
  });

  it("deletes a selected zone with the Delete key", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await selectZoneTool(user);
    createRectangleZone(canvas);

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Delete" });

    expect(screen.queryByLabelText("Zone 1")).not.toBeInTheDocument();
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: null,
      selectedIds: []
    });
  });
});
