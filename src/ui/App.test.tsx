import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";

import { RENDER_LAYERS } from "../core/rendering/types";
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
    const leftFirstDropMarker = screen.getByLabelText(
      "Drop panel 0 in left docked panels"
    );

    fireEvent.dragStart(statusHandle, { dataTransfer });
    fireEvent.dragOver(leftFirstDropMarker, { dataTransfer });

    expect(leftFirstDropMarker.firstElementChild).toHaveClass("bg-canvas-ink");

    fireEvent.drop(leftFirstDropMarker);

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
    fireEvent.drop(screen.getByLabelText("Drop panel 0 in left docked panels"), {
      dataTransfer
    });

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
});
