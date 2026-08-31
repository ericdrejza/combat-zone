import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderApp } from "@tests/ui/renderApp";
import { movePanel } from "@ui/panels/panelLayout";
import { appendEncounterLogEntry } from "@store/encounterLogSlice";
import { store } from "@store/store";

describe("PanelsShell", () => {
  it("renders categorized action and validation-block entries in the Log panel", () => {
    renderApp();

    act(() => {
      store.dispatch(
        appendEncounterLogEntry({
          actionId: "actor.move-1",
          actionType: "actor.move",
          category: "actor",
          id: "actor.move-1:commit",
          kind: "commit",
          message: "Aria moved to the Courtyard.",
          timestamp: 1
        })
      );
      store.dispatch(
        appendEncounterLogEntry({
          actionId: "actor.move-2",
          actionType: "actor.move",
          category: "validation",
          id: "actor.move-2:validation-block",
          kind: "validation-block",
          message: "Blocked action: Aria moved to the Vault. Not enough room.",
          timestamp: 2
        })
      );
    });

    const log = screen.getByLabelText("Encounter log");
    expect(within(log).getByText("Actor")).toBeInTheDocument();
    expect(within(log).getByText("Validation")).toBeInTheDocument();
    expect(within(log).getByText("Blocked")).toBeInTheDocument();
    expect(
      within(log).getByText("Aria moved to the Courtyard.")
    ).toBeInTheDocument();
  });

  it("clears the encounter log from the Log panel header", () => {
    renderApp();

    act(() => {
      store.dispatch(
        appendEncounterLogEntry({
          actionId: "actor.move-1",
          actionType: "actor.move",
          category: "actor",
          id: "actor.move-1:commit",
          kind: "commit",
          message: "Aria moved to the Courtyard.",
          timestamp: 1
        })
      );
    });

    const clearButton = screen.getByRole("button", {
      name: "Clear encounter log"
    });
    const reorderButton = screen.getByRole("button", {
      name: "Reorder Log panel"
    });

    expect(clearButton.nextElementSibling).toBe(reorderButton);
    expect(screen.getByLabelText("Encounter log")).toHaveClass(
      "max-h-80",
      "overflow-y-auto"
    );

    fireEvent.click(clearButton);

    expect(
      screen.getByText("Actions and blocked validation attempts will appear here.")
    ).toBeInTheDocument();
    expect(store.getState().encounterLog.entries).toEqual([]);
  });

  it("supports collapsible vertically stacked dock panels", async () => {
    const user = userEvent.setup();

    renderApp();

    expect(screen.getByText("Actor or Background tools show library assets here.")).toBeInTheDocument();
    expect(
      screen.getByText("Add actors to begin tracking initiative.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Actions and blocked validation attempts will appear here.")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Collapse Library panel" })
    );

    expect(
      screen.getByText("Add actors to begin tracking initiative.")
    ).toBeInTheDocument();
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
    ).toEqual(["Status", "Library", "Properties", "Log"]);
  });

  it("moves side panels with a touch pointer drag", () => {
    renderApp();
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const leftDock = screen.getByLabelText("left docked panels");
    const leftTopDropZone = screen.getByLabelText(
      "Drop panel 0 in left docked panels"
    );
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => leftTopDropZone);

    try {
      fireEvent.pointerDown(statusHandle, {
        button: 0,
        clientX: 200,
        clientY: 200,
        isPrimary: true,
        pointerId: 7,
        pointerType: "touch"
      });
      fireEvent.pointerMove(window, {
        clientX: 100,
        clientY: 100,
        pointerId: 7,
        pointerType: "touch"
      });

      expect(leftTopDropZone.firstElementChild).toHaveClass("bg-canvas-ink");

      fireEvent.pointerUp(window, {
        clientX: 100,
        clientY: 100,
        pointerId: 7,
        pointerType: "touch"
      });

      expect(
        within(leftDock)
          .getAllByRole("heading")
          .map((heading) => heading.textContent)
      ).toEqual(["Status", "Library", "Properties", "Log"]);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it("moves side panels with a mouse pointer drag", () => {
    renderApp();
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const leftDock = screen.getByLabelText("left docked panels");
    const leftTopDropZone = screen.getByLabelText(
      "Drop panel 0 in left docked panels"
    );
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => leftTopDropZone);

    try {
      fireEvent.pointerDown(statusHandle, {
        button: 0,
        clientX: 200,
        clientY: 200,
        isPrimary: true,
        pointerId: 9,
        pointerType: "mouse"
      });
      fireEvent.pointerMove(window, {
        clientX: 100,
        clientY: 100,
        pointerId: 9,
        pointerType: "mouse"
      });
      fireEvent.pointerUp(window, {
        clientX: 100,
        clientY: 100,
        pointerId: 9,
        pointerType: "mouse"
      });

      expect(
        within(leftDock)
          .getAllByRole("heading")
          .map((heading) => heading.textContent)
      ).toEqual(["Status", "Library", "Properties", "Log"]);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it("does not start a touch reorder before the drag threshold", () => {
    renderApp();
    const statusHandle = screen.getByRole("button", {
      name: "Reorder Status panel"
    });
    const leftDock = screen.getByLabelText("left docked panels");
    const leftTopDropZone = screen.getByLabelText(
      "Drop panel 0 in left docked panels"
    );
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn(() => leftTopDropZone);

    try {
      fireEvent.pointerDown(statusHandle, {
        button: 0,
        clientX: 100,
        clientY: 100,
        isPrimary: true,
        pointerId: 8,
        pointerType: "touch"
      });
      fireEvent.pointerMove(window, {
        clientX: 102,
        clientY: 102,
        pointerId: 8,
        pointerType: "touch"
      });
      fireEvent.pointerUp(window, {
        clientX: 102,
        clientY: 102,
        pointerId: 8,
        pointerType: "touch"
      });

      expect(
        within(leftDock)
          .getAllByRole("heading")
          .map((heading) => heading.textContent)
      ).toEqual(["Library", "Properties", "Log"]);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
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
    ).toEqual(["Library", "Status", "Properties", "Log"]);
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
        { id: "log", title: "Log", collapsed: false }
      ]
    };

    expect(
      movePanel(layout, "status", {
        side: "right",
        index: 2
      }).right.map((panel) => panel.id)
    ).toEqual(["properties", "status", "log"]);
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
    ).toEqual(["Status", "Library", "Properties", "Log"]);
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
