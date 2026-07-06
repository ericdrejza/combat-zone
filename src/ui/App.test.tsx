import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { RENDER_LAYERS } from "../core/rendering/types";
import { clearSelection, setActiveTool } from "../interaction/interactionState";
import { store } from "../store/store";
import { App, movePanel } from "./App";

describe("App", () => {
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
    ).toEqual(["Zone", "Edge", "Background", "Annotation", "Actor", "Select"]);
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

  it("selects canvas entities through the active tool interaction contract", () => {
    store.dispatch(setActiveTool("select"));
    store.dispatch(clearSelection());

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    fireEvent.click(screen.getByLabelText("Selection overlay placeholder"));

    expect(store.getState().interaction.selection).toMatchObject({
      selectedEntityType: "zone",
      selectedIds: ["selection-placeholder"]
    });
  });

  it("renders canvas layers in documented order with selection overlay support", () => {
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
      screen.getByLabelText("Selection overlay placeholder")
    ).toBeInTheDocument();
  });

  it("supports collapsible vertically stacked dock panels", async () => {
    const user = userEvent.setup();

    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(4);

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );

    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(3);
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
    ).toEqual(["Status", "Library", "Initiative"]);
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
    const initiativePanel = screen.getByLabelText("Initiative panel");
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

    initiativePanel.getBoundingClientRect = () => panelBounds;

    fireEvent.dragStart(statusHandle, { dataTransfer });
    fireEvent.dragOver(initiativePanel, { clientY: 90, dataTransfer });

    expect(
      screen.getByLabelText("Drop panel 1 in left docked panels").firstElementChild
    ).toHaveClass("bg-canvas-ink");

    fireEvent.drop(initiativePanel, { clientY: 90 });

    expect(
      within(leftDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Library", "Status", "Initiative"]);
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
    ).toEqual(["Status", "Library", "Initiative"]);
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
      "Drop panel 3 in right docked panels"
    );

    fireEvent.dragStart(libraryHandle, { dataTransfer });
    fireEvent.dragOver(rightBottomDropZone, { dataTransfer });

    expect(rightBottomDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(rightBottomDropZone);

    expect(
      within(rightDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Properties", "Status", "Validation", "Library"]);
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
      "Drop panel 3 in right docked panels"
    );

    fireEvent.dragStart(libraryHandle, { dataTransfer });
    fireEvent.dragOver(rightDock, { dataTransfer });

    expect(rightBottomDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(rightDock, { dataTransfer });

    expect(
      within(rightDock)
        .getAllByRole("heading")
        .map((heading) => heading.textContent)
    ).toEqual(["Properties", "Status", "Validation", "Library"]);
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
});
