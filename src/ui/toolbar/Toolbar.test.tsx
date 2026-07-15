import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp
} from "@test/ui/renderApp";

function createActorDragDataTransfer() {
  const data = new Map<string, string>();
  const types: string[] = [];

  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
      types.push(type);
    },
    types
  };
}

function dropOnCanvas(
  canvas: HTMLElement,
  transfer: ReturnType<typeof createActorDragDataTransfer>,
  clientX: number,
  clientY: number
) {
  const event = new Event("drop", { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    dataTransfer: { value: transfer }
  });
  canvas.dispatchEvent(event);
}

describe("Toolbar", () => {
  it("renders toolbar tools in the expected order with requested separators", () => {
    renderApp();
    const tools = screen.getByRole("navigation", { name: "Tools" });

    expect(
      within(tools)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual([
      "Library",
      "Background",
      "Zone",
      "Edge",
      "Annotation",
      "Actor",
      "Select"
    ]);
    expect(screen.getAllByRole("button", { name: "Library" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Background" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Engagement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(tools).getAllByRole("separator")).toHaveLength(6);
  });

  it("opens the Asset Library modal from the Library toolbar button", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Library" }));

    expect(screen.getByRole("dialog", { name: "Asset Library" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Encounters" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Close Asset Library" }));

    expect(
      screen.queryByRole("dialog", { name: "Asset Library" })
    ).not.toBeInTheDocument();
  });

  it("activates toolbar tools from button clicks and keyboard shortcuts", async () => {
    const user = userEvent.setup();

    renderApp();

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

  it("renders distinct token size icons for actor sizes", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));

    const sizeButtons = [
      screen.getByRole("button", { name: "Small actor size" }),
      screen.getByRole("button", { name: "Medium actor size" }),
      screen.getByRole("button", { name: "Large actor size" }),
      screen.getByRole("button", { name: "X-large actor size" })
    ];

    expect(
      sizeButtons.map(
        (button) => button.querySelectorAll("svg rect").length
      )
    ).toEqual([1, 1, 4, 9]);
    expect(
      sizeButtons.map(
        (button) => button.querySelector("svg rect")?.getAttribute("width")
      )
    ).toEqual(["8", "12", "5", "4"]);
  });

  it("separates actor option groups and gives option buttons concise tooltips", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));

    expect(screen.getByRole("group", { name: "Actor faction" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor size" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor shape" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("group", { name: "Actor paint" })).toHaveClass(
      "rounded-full"
    );
    expect(screen.getByRole("button", { name: "Hero faction" })).toHaveAttribute(
      "title",
      "Hero"
    );
    expect(
      screen.getByRole("button", { name: "Small actor size" })
    ).toHaveAttribute("title", "Small");
    expect(
      screen.getByRole("button", { name: "Rectangle actor shape" })
    ).toHaveAttribute("title", "Rectangle");
    expect(screen.getByRole("button", { name: "Paint actors" })).toHaveAttribute(
      "title",
      "Paint"
    );
  });

  it("toggles actor paint mode from the actor toolbar", async () => {
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    expect(store.getState().interaction.actorPaintBrush).toBe(true);
    expect(screen.getByRole("button", { name: "Paint actors" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await user.click(screen.getByRole("button", { name: "Paint actors" }));

    expect(store.getState().interaction.actorPaintBrush).toBe(false);
  });

  it("opens the actor creation modal with a target-aware create action and preview", async () => {
    const user = userEvent.setup();

    renderApp();
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Create actor" }));

    expect(screen.getByText("Drag actor to zone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas);
    await user.click(screen.getByRole("button", { name: "Actor" }));
    fireEvent.click(screen.getByLabelText("Zone 1"));
    await user.click(screen.getByRole("button", { name: "Create actor" }));

    const input = screen.getByRole("textbox", { name: "Actor name" });
    await user.type(input, "Goblin Scout");

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByLabelText("Actor preview")).toHaveTextContent("Goblin Scout");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.queryByRole("dialog", { name: "Create actor" })).not.toBeInTheDocument();
    const targetZoneId = store.getState().encounter.present.zones.allIds[0];
    expect(
      Object.values(store.getState().encounter.present.actors.byId).some(
        (actor) =>
          actor.name === "Goblin Scout" && actor.currentZoneId === targetZoneId
      )
    ).toBe(true);
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe("actor.create");
  });

  it("creates the preview actor in a zone when dragged from the modal", async () => {
    const user = userEvent.setup();
    const transfer = createActorDragDataTransfer();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas);
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(screen.getByRole("textbox", { name: "Actor name" }), "Dragged Actor");
    fireEvent.dragStart(screen.getByLabelText("Actor preview"), {
      dataTransfer: transfer
    });

    expect(screen.getByRole("dialog", { name: "Create actor" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create actor" })
      ).not.toBeInTheDocument();
    });

    fireEvent.dragOver(canvas, {
      clientX: 100,
      clientY: 100,
      dataTransfer: transfer
    });
    expect(transfer.effectAllowed).toBe("copy");
    expect(transfer.dropEffect).toBe("copy");
    dropOnCanvas(canvas, transfer, 100, 100);

    const actor = Object.values(store.getState().encounter.present.actors.byId).find(
      (candidate) => candidate.name === "Dragged Actor"
    );
    const targetZoneId = store.getState().encounter.present.zones.allIds[0];
    const actorsInTargetZone = Object.values(
      store.getState().encounter.present.actors.byId
    ).filter((candidate) => candidate.currentZoneId === targetZoneId);
    expect(actorsInTargetZone).toHaveLength(1);
    expect(actor?.currentZoneId).toBe(targetZoneId);
    expect(store.getState().interaction.selection.selectedIds).toEqual([actor?.id]);
  });

  it("opens Zone shape radios from the Zone toolbar button", async () => {
    const user = userEvent.setup();

    renderApp();

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
      screen.getByRole("radiogroup", { name: "Zone shape options" })
    ).toBeInTheDocument();
  });

  it("adds and deletes a canvas background image from the Background toolbar menu", async () => {
    const user = userEvent.setup();

    renderApp();

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
    expect(screen.getByRole("menuitem", { name: "Add" })).toBeInTheDocument();
  });
});
