import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { RENDER_LAYERS } from "../core/rendering/types";
import {
  clearSelection,
  resetInteractionState,
  setActiveTool
} from "../interaction/interactionState";
import { resetEncounterState } from "../store/encounterSlice";
import { store } from "../store/store";
import { App, movePanel } from "./App";

describe("App", () => {
  beforeEach(() => {
    store.dispatch(resetEncounterState());
    store.dispatch(resetInteractionState());
  });

  it("renders the part 5 workspace frame", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(screen.getByRole("banner", { name: "Combat Zone toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Encounter canvas" })).toBeInTheDocument();
    expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
    expect(screen.getByLabelText("right docked panels")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Bottom status, initiative, and validation area")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Status panel")).toBeInTheDocument();
    expect(screen.getByText("Entity detail scaffold.")).toBeInTheDocument();
  });

  it("omits the Pan toolbar button because panning uses right-click drag", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(screen.queryByRole("button", { name: "Pan" })).not.toBeInTheDocument();
  });

  it("renders toolbar tools in the expected order with requested separators", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const tools = screen.getByRole("navigation", { name: "Tools" });

    expect(
      within(tools)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["Background", "Zone", "Edge", "Annotation", "Actor", "Select"]);
    expect(screen.getAllByRole("button", { name: "Background" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Engagement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(tools).getAllByRole("separator")).toHaveLength(2);
  });

  it("activates toolbar tools from button clicks and keyboard shortcuts", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.click(screen.getByRole("button", { name: "Zone" }));

    expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.keyDown(window, { key: "a" });

    expect(screen.getByRole("button", { name: "Actor" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("opens Zone shape radios from the Zone toolbar button", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.click(screen.getByRole("button", { name: "Zone" }));

    const shapeOptions = screen.getByRole("radiogroup", {
      name: "Zone shape options"
    });

    expect(
      within(shapeOptions).getByRole("radio", { name: "Rectangle zone shape" })
    ).toHaveAttribute("aria-checked", "true");
    expect(within(shapeOptions).getByText("1")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("2")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("3")).toBeInTheDocument();
    expect(within(shapeOptions).getByText("4")).toBeInTheDocument();
    expect(
      within(shapeOptions).getByRole("radio", { name: "Hexagon zone shape" })
    ).toBeInTheDocument();

    await user.click(
      within(shapeOptions).getByRole("radio", { name: "Circle zone shape" })
    );

    expect(store.getState().interaction.zoneShapeMode).toBe("circle");
    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Zone shape options" })
    ).not.toBeInTheDocument();
  });

  it("selects canvas entities through the active tool interaction contract", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

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

  it("renders canvas layers in documented order without placeholder overlays", () => {
    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const layerIds = Array.from(container.querySelectorAll("[data-layer]")).map(
      (layer) => layer.getAttribute("data-layer")
    );

    expect(layerIds).toEqual(RENDER_LAYERS.map((layer) => layer.id));
    expect(
      screen.queryByLabelText("Selection overlay placeholder")
    ).not.toBeInTheDocument();
  });

  it("supports collapsible vertically stacked dock panels", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(3);

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );

    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("collapses and expands either sidebar independently", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.click(screen.getByRole("button", { name: "Collapse left sidebar" }));

    expect(screen.queryByLabelText("left docked panels")).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Encounter canvas" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand left sidebar" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Collapse right sidebar" }));

    expect(screen.queryByLabelText("right docked panels")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand right sidebar" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Expand left sidebar" }));
    await user.click(screen.getByRole("button", { name: "Expand right sidebar" }));

    expect(screen.getByLabelText("left docked panels")).toBeInTheDocument();
    expect(screen.getByLabelText("right docked panels")).toBeInTheDocument();
  });

  it("moves side panels by dragging the reorder handle to a drop marker", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const leftDock = screen.getByLabelText("left docked panels");
    const leftTopDropZone = screen.getByLabelText(
      "Drop panel 0 in left docked panels"
    );

    fireEvent.dragStart(statusHandle, { dataTransfer });
    fireEvent.dragOver(leftTopDropZone, { dataTransfer });

    expect(leftTopDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(leftTopDropZone);

    expect(
      within(leftDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Status", "Library", "Properties", "Validation"]);
  });

  it("allows dragged panels to be dropped on a panel surface instead of only on the gap marker", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const propertiesPanel = screen.getByLabelText("Properties panel");
    const leftDock = screen.getByLabelText("left docked panels");
    const panelBounds = {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      toJSON() {},
      top: 0,
      width: 100,
      x: 0,
      y: 0
    };

    propertiesPanel.getBoundingClientRect = () => panelBounds;

    fireEvent.dragStart(statusHandle, { dataTransfer });
    fireEvent.dragOver(propertiesPanel, { clientY: 10, dataTransfer });

    expect(
      screen.getByLabelText("Drop panel 1 in left docked panels").firstElementChild
    ).toHaveClass("bg-canvas-ink");

    fireEvent.drop(propertiesPanel, { clientY: 10 });

    expect(
      within(leftDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Library", "Status", "Properties", "Validation"]);
  });

  it("keeps a panel in place when dropping it into the lower half of itself", () => {
    const layout = {
      left: [
        { id: "library", title: "Library", collapsed: false },
        { id: "initiative", title: "Initiative", collapsed: false }
      ],
      right: [
        { id: "properties", title: "Properties", collapsed: false },
        { id: "status", title: "Status", collapsed: false },
        { id: "validation", title: "Validation", collapsed: false }
      ]
    };

    expect(
      movePanel(layout, "status", {
        side: "right",
        index: 2
      }).right.map((panel) => panel.id)
    ).toEqual(["properties", "status", "validation"]);
  });

  it("preserves collapsed panel state after dragging a panel to the other side", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };

    await user.click(
      screen.getByRole("button", { name: "Collapse Status panel" })
    );

    expect(screen.queryByText("Entity detail scaffold.")).not.toBeInTheDocument();

    fireEvent.dragStart(
      screen.getByRole("button", { name: "Reorder Status panel" }),
      { dataTransfer }
    );
    fireEvent.drop(
      screen.getByLabelText("Drop panel 0 in left docked panels"),
      {
        dataTransfer
      }
    );

    const leftDock = screen.getByLabelText("left docked panels");

    expect(
      within(leftDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Status", "Library", "Properties", "Validation"]);
    expect(
      within(leftDock).getByRole("button", { name: "Expand Status panel" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Entity detail scaffold.")).not.toBeInTheDocument();
  });

  it("supports dropping a panel below the last panel in a sidebar", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };
    const libraryHandle = screen.getByRole("button", {
      name: "Reorder Library panel"
    });
    const rightDock = screen.getByLabelText("right docked panels");
    const rightBottomDropZone = screen.getByLabelText(
      "Drop panel 2 in right docked panels"
    );

    fireEvent.dragStart(libraryHandle, { dataTransfer });
    fireEvent.dragOver(rightBottomDropZone, { dataTransfer });

    expect(rightBottomDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(rightBottomDropZone);

    expect(
      within(rightDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Initiative", "Status", "Library"]);
  });

  it("uses open dock space as a drop target and keeps the bottom insertion marker visible", () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };
    const libraryHandle = screen.getByRole("button", {
      name: "Reorder Library panel"
    });
    const rightDock = screen.getByLabelText("right docked panels");
    const rightBottomDropZone = screen.getByLabelText(
      "Drop panel 2 in right docked panels"
    );

    fireEvent.dragStart(libraryHandle, { dataTransfer });
    fireEvent.dragOver(rightDock, { dataTransfer });

    expect(rightBottomDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(rightDock, { dataTransfer });

    expect(
      within(rightDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Initiative", "Status", "Library"]);
  });

  it("adds and deletes a canvas background image from the Background toolbar menu", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Replace" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Delete" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Add" }));

    fireEvent.change(screen.getByLabelText("Upload background image"), {
      target: {
        files: [
          new File(["background"], "battle-map.png", {
            type: "image/png"
          })
        ]
      }
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("Canvas background image")
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Zone" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Background" }));

    expect(screen.getByRole("menuitem", { name: "Replace" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Add" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(
        screen.queryByLabelText("Canvas background image")
      ).not.toBeInTheDocument();
    });
  });

  it("creates a zone from sequential Zone Tool points and edits its layout properties", async () => {
    const user = userEvent.setup();
    const nextZoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "4" });

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });
    fireEvent.doubleClick(canvas, { clientX: 220, clientY: 220 });

    expect(await screen.findByLabelText(nextZoneName)).toBeInTheDocument();
    expect(screen.queryByLabelText("Layout orientation")).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SPLIT_FLEX" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Layout strategy"), [
      "SPLIT_SEQUENTIAL"
    ]);
    await user.selectOptions(screen.getByLabelText("Layout orientation"), [
      "TOP_BOTTOM"
    ]);

    expect(
      screen.getByText("Current layout descriptor: SPLIT_SEQUENTIAL, TOP_BOTTOM, 3 sections.")
    ).toBeInTheDocument();
  });

  it("creates rectangle zones by default, circle zones with keybind 2, and hexagon zones with keybind 3", async () => {
    const user = userEvent.setup();
    const rectangleZoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    expect(screen.getByText("Zone shape: rectangle")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });

    expect(
      screen.queryByRole("radiogroup", { name: "Zone shape options" })
    ).not.toBeInTheDocument();

    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 180, clientY: 160 });

    const rectangleZone = await screen.findByLabelText(rectangleZoneName);

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [rectangleZone.getAttribute("data-entity-id")]
    });
    expect(screen.getByDisplayValue(rectangleZoneName)).toBeInTheDocument();
    expect(rectangleZone.getAttribute("points")?.split(" ")).toHaveLength(4);

    const circleZoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    fireEvent.keyDown(window, { key: "2" });

    expect(screen.getByText("Zone shape: circle")).toBeInTheDocument();

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const circleZone = await screen.findByLabelText(circleZoneName);

    expect(circleZone.getAttribute("points")?.split(" ")).toHaveLength(60);

    const hexagonZoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    fireEvent.keyDown(window, { key: "3" });

    expect(screen.getByText("Zone shape: hexagon")).toBeInTheDocument();

    fireEvent.mouseDown(canvas, { button: 0, clientX: 420, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 520, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const hexagonZone = await screen.findByLabelText(hexagonZoneName);

    expect(hexagonZone.getAttribute("points")?.split(" ")).toHaveLength(6);
  });

  it("selects newly created zones without expanding a collapsed properties panel", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(
      screen.getByRole("button", { name: "Collapse Properties panel" })
    );
    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 180, clientY: 160 });

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

  it("selects and drags an existing zone in Zone mode instead of drawing over it", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 120, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 220, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);
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

  it("rejects zone moves and resizes that would drop vertices off screen", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const originalPoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: -80, clientY: -80 });
    fireEvent.mouseUp(canvas);

    expect(zone).toHaveAttribute("points", originalPoints ?? "");

    const topLeftHandle = screen.getByLabelText("Zone 1 vertex 1");

    fireEvent.mouseDown(topLeftHandle, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: -20, clientY: -20 });
    fireEvent.mouseUp(canvas);

    expect(zone).toHaveAttribute("points", originalPoints ?? "");
  });

  it("shows clicked Zone Tool zone details in the properties panel", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);

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

  it("supports ctrl-click, shift-drag, ctrl-a multi-select and exports first zone properties", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 160, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 220, clientY: 100 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 300, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 360, clientY: 100 });
    fireEvent.mouseUp(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");
    const thirdZone = await screen.findByLabelText("Zone 3");
    const firstZoneId = firstZone.getAttribute("data-entity-id") ?? "";
    const secondZoneId = secondZone.getAttribute("data-entity-id") ?? "";
    const thirdZoneId = thirdZone.getAttribute("data-entity-id") ?? "";

    fireEvent.mouseDown(firstZone, { button: 0, clientX: 60, clientY: 60 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(firstZone, { clientX: 60, clientY: 60 });
    fireEvent.mouseDown(secondZone, {
      button: 0,
      clientX: 180,
      clientY: 60,
      ctrlKey: true
    });
    fireEvent.mouseUp(canvas);
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
    expect(
      screen.getByRole("button", { name: "Export first selected zone properties" })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Fill color #bfdbfe" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.4" }
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
      target: { value: "hazard, elevated" }
    });
    fireEvent.blur(screen.getByLabelText("Tags"));

    await user.click(
      screen.getByRole("button", { name: "Export first selected zone properties" })
    );

    const zones = store.getState().encounter.present.zones.byId;

    expect(zones[secondZoneId]).toMatchObject({
      colorFill: "#bfdbfe",
      layoutStrategy: "SPLIT_FLEX",
      layoutOrientation: "TOP_BOTTOM",
      namePosition: "bottom-right",
      opacity: 0.4,
      showName: true,
      tags: ["hazard", "elevated"]
    });
    expect(zones[thirdZoneId]).toMatchObject({
      colorFill: "#bfdbfe",
      layoutStrategy: "SPLIT_FLEX",
      layoutOrientation: "TOP_BOTTOM",
      namePosition: "bottom-right",
      opacity: 0.4,
      showName: true,
      tags: ["hazard", "elevated"]
    });
  });

  it("tabs through zones by horizontal position then vertical position", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 300, clientY: 160 });
    fireEvent.mouseMove(canvas, { clientX: 360, clientY: 220 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 240 });
    fireEvent.mouseMove(canvas, { clientX: 160, clientY: 300 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 160, clientY: 140 });
    fireEvent.mouseUp(canvas);

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

  it("unselects selected entities when clicking blank canvas", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

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

  it("edits zone fill, opacity, border, and name display properties", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText("Zone 1");

    expect(zone).toHaveAttribute("fill", "#ffffff");
    expect(zone).toHaveAttribute("fill-opacity", "0");
    expect(screen.queryByText("Zone 1")).not.toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Color" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Color" }));

    expect(screen.getByRole("button", { name: "Color" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(
      screen.queryByRole("button", { name: "Fill color #bfdbfe" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Color" }));
    await user.click(screen.getByRole("button", { name: "Fill color #365314" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0" }
    });
    await user.click(screen.getByRole("checkbox", { name: /Show border/ }));
    await user.click(screen.getByRole("checkbox", { name: /Show name/ }));
    await user.click(screen.getByRole("radio", { name: "Bottom right" }));

    expect(zone).toHaveAttribute("fill", "#365314");
    expect(zone).toHaveAttribute("fill-opacity", "0");
    expect(zone).toHaveAttribute("stroke", "transparent");
    expect(zone).toHaveAttribute("stroke-width", "0");
    expect(screen.getByText("Zone 1")).toHaveAttribute("fill", "#111827");
    expect(store.getState().encounter.present.zones.byId[
      zone.getAttribute("data-entity-id") ?? ""
    ]).toMatchObject({
      colorFill: "#365314",
      namePosition: "bottom-right",
      opacity: 0,
      showBorder: false,
      showName: true
    });
  });

  it("uses the last modified zone opacity for newly created zones", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");

    expect(firstZone).toHaveAttribute("fill-opacity", "0");

    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.35" }
    });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 260, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 360, clientY: 160 });
    fireEvent.mouseUp(canvas);

    expect(await screen.findByLabelText("Zone 2")).toHaveAttribute(
      "fill-opacity",
      "0.35"
    );
  });

  it("paints copied zone color properties onto another zone and exits paint mode by Escape", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 260, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 360, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const firstZone = await screen.findByLabelText("Zone 1");
    const secondZone = await screen.findByLabelText("Zone 2");

    fireEvent.click(firstZone, { clientX: 120, clientY: 120 });
    const firstZoneId = firstZone.getAttribute("data-entity-id");

    await user.click(screen.getByRole("button", { name: "Fill color #bfdbfe" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.25" }
    });
    await user.click(screen.getByRole("checkbox", { name: /Show border/ }));
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toMatchObject({
      sourceZoneId: firstZoneId
    });

    await user.click(screen.getByRole("button", { name: "Fill color #bbf7d0" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "0.4" }
    });

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));
    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.click(firstZone, { clientX: 120, clientY: 120 });
    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    fireEvent.click(canvas, { clientX: 460, clientY: 300 });

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [firstZoneId]
    });
    expect(screen.getByDisplayValue("Zone 1")).toBeInTheDocument();
    expect(store.getState().interaction.zonePaintBrush).not.toBeNull();

    fireEvent.click(secondZone, { clientX: 300, clientY: 120 });

    expect(secondZone).toHaveAttribute("fill", "#bbf7d0");
    expect(secondZone).toHaveAttribute("fill-opacity", "0.4");
    expect(secondZone).toHaveAttribute("stroke", "transparent");
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [firstZoneId]
    });
    expect(store.getState().interaction.zonePaintBrush).not.toBeNull();

    fireEvent.contextMenu(canvas, { clientX: 320, clientY: 120 });

    expect(store.getState().interaction.zonePaintBrush).toBeNull();

    await user.click(screen.getByRole("button", { name: "Paint zone colors" }));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(store.getState().interaction.zonePaintBrush).toBeNull();
  });

  it("clones selected zone properties when ctrl-dragging a new zone", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

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

  it("resizes rectangle zones with connected corners instead of moving one vertex", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);
    const topRightHandle = screen.getByLabelText(`${zoneName} vertex 2`);

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

  it("shows eight circle resize handles while storing the circle as polygon geometry", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "2" });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);

    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(60);
    expect(screen.getAllByLabelText(new RegExp(`${zoneName} vertex`))).toHaveLength(8);
  });

  it("shows eight hexagon resize handles while storing the hexagon as six polygon segments", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "3" });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);

    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(screen.getAllByLabelText(new RegExp(`${zoneName} vertex`))).toHaveLength(8);
  });

  it("keeps hexagon zones selected after resizing from orthogonal and top-left bounds handles", async () => {
    const user = userEvent.setup();
    const zoneName = "Zone 1";

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "3" });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText(zoneName);
    const originalPoints = zone.getAttribute("points");
    const rightHandle = screen.getByLabelText(`${zoneName} vertex 3`);

    fireEvent.mouseDown(rightHandle, { button: 0, clientX: 340, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 390, clientY: 150 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 390, clientY: 150 });

    expect(zone.getAttribute("points")).not.toBe(originalPoints);
    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });

    const afterRightResizePoints = zone.getAttribute("points");
    const leftHandle = screen.getByLabelText(`${zoneName} vertex 7`);

    fireEvent.mouseDown(leftHandle, { button: 0, clientX: 240, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 210, clientY: 150 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 210, clientY: 150 });

    expect(zone.getAttribute("points")).not.toBe(afterRightResizePoints);
    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });

    const afterLeftResizePoints = zone.getAttribute("points");
    const topHandle = screen.getByLabelText(`${zoneName} vertex 1`);

    fireEvent.mouseDown(topHandle, { button: 0, clientX: 300, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 80 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 300, clientY: 80 });

    expect(zone.getAttribute("points")).not.toBe(afterLeftResizePoints);
    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });

    const afterTopResizePoints = zone.getAttribute("points");
    const bottomHandle = screen.getByLabelText(`${zoneName} vertex 5`);

    fireEvent.mouseDown(bottomHandle, { button: 0, clientX: 300, clientY: 200 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 230 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 300, clientY: 230 });

    expect(zone.getAttribute("points")).not.toBe(afterTopResizePoints);
    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });

    const afterBottomResizePoints = zone.getAttribute("points");
    const topLeftHandle = screen.getByLabelText(`${zoneName} vertex 8`);

    fireEvent.mouseDown(topLeftHandle, { button: 0, clientX: 210, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 190, clientY: 60 });
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas, { clientX: 190, clientY: 60 });

    expect(zone.getAttribute("points")).not.toBe(afterBottomResizePoints);
    expect(zone.getAttribute("points")?.split(" ")).toHaveLength(6);
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: [zone.getAttribute("data-entity-id")]
    });
  });

  it("uses background luminance for circle zone name text even with opaque fill", async () => {
    const user = userEvent.setup();
    const zoneName = "Zone 1";

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "2" });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    await screen.findByLabelText(zoneName);
    await user.click(screen.getByRole("button", { name: "Fill color #991b1b" }));
    fireEvent.change(screen.getByLabelText("Zone opacity"), {
      target: { value: "1" }
    });
    await user.click(screen.getByRole("checkbox", { name: /Show name/ }));

    await waitFor(() => {
      const zoneNameText = Array.from(canvas.querySelectorAll("text")).find(
        (element) => element.textContent === zoneName
      );

      expect(zoneNameText).toHaveAttribute("fill", "#111827");
    });
  });

  it("resizes circle zones from corner handles without preserving aspect ratio", async () => {
    const user = userEvent.setup();
    const zoneName = "Zone 1";

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "2" });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 240, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 200 });
    fireEvent.mouseUp(canvas);

    fireEvent.mouseDown(screen.getByLabelText(`${zoneName} vertex 2`), {
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

  it("keeps multi-selected zones selected when modifier-clicking empty canvas", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 160, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 220, clientY: 100 });
    fireEvent.mouseUp(canvas);

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

  it("prevents creating a zone on top of an existing zone", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(canvas);

    expect(await screen.findByLabelText("Zone 1")).toBeInTheDocument();

    fireEvent.mouseDown(canvas, { button: 0, clientX: 150, clientY: 150 });
    fireEvent.mouseMove(canvas, { clientX: 240, clientY: 240 });
    fireEvent.mouseUp(canvas);

    expect(screen.queryByLabelText("Zone 2")).not.toBeInTheDocument();
    expect(store.getState().encounter.present.zones.allIds).toHaveLength(1);
  });

  it("prevents dropping an existing zone onto another zone", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 160, clientY: 160 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseDown(canvas, { button: 0, clientX: 260, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 340, clientY: 160 });
    fireEvent.mouseUp(canvas);

    const zone = await screen.findByLabelText("Zone 2");
    const beforePoints = zone.getAttribute("points");

    fireEvent.mouseDown(zone, { button: 0, clientX: 300, clientY: 120 });
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(canvas);

    expect(zone.getAttribute("points")).toEqual(beforePoints);
  });

  it("maps zone creation points correctly when the SVG viewport is letterboxed", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 1200,
      toJSON() {},
      top: 0,
      width: 1200,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 220, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 320, clientY: 200 });
    fireEvent.mouseUp(canvas);

    expect(await screen.findByLabelText("Zone 1")).toHaveAttribute(
      "points",
      "100,100 200,100 200,200 100,200"
    );
  });

  it("clears polygon draft points with Escape", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "4" });

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });

    expect(screen.getByLabelText("Zone draft")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByLabelText("Zone draft")).not.toBeInTheDocument();
  });

  it("uses background luminance for polygon draft line and vertex colors", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "4" });

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

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));
    fireEvent.keyDown(window, { key: "4" });

    fireEvent.click(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 220, clientY: 100 });
    fireEvent.contextMenu(canvas, { clientX: 220, clientY: 100 });
    fireEvent.doubleClick(canvas, { clientX: 220, clientY: 220 });

    expect(screen.queryByLabelText("Zone 1")).not.toBeInTheDocument();
  });

  it("deletes a selected zone with the Delete key", async () => {
    const user = userEvent.setup();
    const zoneName = `Zone ${
      store.getState().encounter.present.zones.allIds.length + 1
    }`;

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 80, clientY: 80 });
    fireEvent.mouseMove(canvas, { clientX: 180, clientY: 160 });
    fireEvent.mouseUp(canvas);

    expect(await screen.findByLabelText(zoneName)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Delete" });

    expect(screen.queryByLabelText(zoneName)).not.toBeInTheDocument();
    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: null,
      selectedIds: []
    });
  });

  it("does not render foreignObject zone contents for any zone shape", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const canvas = screen.getByLabelText("SVG encounter workspace");

    canvas.getBoundingClientRect = () => ({
      bottom: 640,
      height: 640,
      left: 0,
      right: 960,
      toJSON() {},
      top: 0,
      width: 960,
      x: 0,
      y: 0
    });

    await user.click(screen.getByRole("button", { name: "Zone" }));

    fireEvent.mouseDown(canvas, { button: 0, clientX: 40, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(canvas);

    fireEvent.keyDown(window, { key: "2" });
    fireEvent.mouseDown(canvas, { button: 0, clientX: 180, clientY: 40 });
    fireEvent.mouseMove(canvas, { clientX: 260, clientY: 120 });
    fireEvent.mouseUp(canvas);

    fireEvent.keyDown(window, { key: "4" });

    fireEvent.click(canvas, { clientX: 320, clientY: 40 });
    fireEvent.click(canvas, { clientX: 440, clientY: 40 });
    fireEvent.doubleClick(canvas, { clientX: 440, clientY: 160 });

    expect(await screen.findByLabelText("Zone 3")).toBeInTheDocument();
    expect(container.querySelector("foreignObject")).toBeNull();
  });
});
