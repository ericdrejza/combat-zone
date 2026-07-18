import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@tests/ui/renderApp";
import { movePanel } from "@ui/panels/panelLayout";

describe("PanelsShell", () => {
  it("supports collapsible vertically stacked dock panels", async () => {
    const user = userEvent.setup();

    renderApp();

    expect(screen.getByText("Actor or Background tools show library assets here.")).toBeInTheDocument();
    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(2);

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );

    expect(screen.getAllByText("Panel scaffold.", { exact: false })).toHaveLength(2);
    expect(
      screen.queryByText("Actor or Background tools show library assets here.")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand Library panel" })
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("moves side panels by dragging the reorder handle to a drop marker", () => {
    renderApp();
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
    renderApp();
    const dataTransfer = {
      effectAllowed: "",
      setData() {}
    };
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const propertiesPanel = screen.getByLabelText("Properties panel");
    const leftDock = screen.getByLabelText("left docked panels");

    propertiesPanel.getBoundingClientRect = () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      toJSON() {},
      top: 0,
      width: 100,
      x: 0,
      y: 0
    });

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

    renderApp();
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
    renderApp();
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
    renderApp();
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
});
