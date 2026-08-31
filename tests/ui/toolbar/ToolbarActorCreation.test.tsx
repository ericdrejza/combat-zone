import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { redoEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import {
  createRectangleZone,
  getCanvas,
  mockCanvasBounds,
  renderApp
} from "@tests/ui/renderApp";

describe("Toolbar actor creation", () => {
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

  it("repeatedly grows an auto-resizing target zone as larger actors are created", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas);

    const zone = await screen.findByLabelText("Zone 1");
    const zoneId = zone.getAttribute("data-entity-id") ?? "";
    const originalRenderedPoints = zone.getAttribute("points");
    const originalPolygon = store.getState().encounter.present.zones.byId[
      zoneId
    ]!.polygon;

    await user.click(
      screen.getByRole("button", { name: "Enable automatic zone resizing" })
    );
    await user.click(screen.getByRole("button", { name: "Actor" }));
    fireEvent.click(zone);

    for (const name of ["First", "Second"]) {
      await user.click(screen.getByRole("button", { name: "Create actor" }));
      await user.type(screen.getByRole("textbox", { name: "Actor name" }), name);
      await user.click(screen.getByRole("button", { name: "Create" }));
      await screen.findByLabelText(name);
    }

    const resizedPolygon = store.getState().encounter.present.zones.byId[
      zoneId
    ]!.polygon;

    expect(resizedPolygon).not.toEqual(originalPolygon);
    expect(store.getState().encounter.present.actors.allIds).toHaveLength(2);
    await waitFor(() => {
      expect(zone.getAttribute("points")).not.toEqual(originalRenderedPoints);
    });
    const mediumActorsPolygon = resizedPolygon;

    await user.click(screen.getByRole("button", { name: "Large actor size" }));
    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(
      screen.getByRole("textbox", { name: "Actor name" }),
      "Large"
    );
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByLabelText("Large");

    const largeActorPolygon = store.getState().encounter.present.zones.byId[
      zoneId
    ]!.polygon;

    expect(largeActorPolygon).not.toEqual(mediumActorsPolygon);
    expect(store.getState().encounter.present.actors.allIds).toHaveLength(3);

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(
      store.getState().encounter.present.zones.byId[zoneId]!.polygon
    ).toEqual(mediumActorsPolygon);
    expect(store.getState().encounter.present.actors.allIds).toHaveLength(2);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(
      store.getState().encounter.present.zones.byId[zoneId]!.polygon
    ).toEqual(largeActorPolygon);
    expect(store.getState().encounter.present.actors.allIds).toHaveLength(3);
  });

  it("animates existing actors when user-created actors change zone composition", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);

    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas, { x: 80, y: 80 }, { x: 420, y: 400 });
    await user.click(screen.getByRole("button", { name: "Actor" }));
    fireEvent.click(screen.getByLabelText("Zone 1"));

    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(screen.getByRole("textbox", { name: "Actor name" }), "First");
    await user.click(screen.getByRole("button", { name: "Create" }));

    const firstActor = await screen.findByLabelText("First");

    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(screen.getByRole("textbox", { name: "Actor name" }), "Second");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await screen.findByLabelText("Second");
    await waitFor(() => {
      expect(firstActor).toHaveAttribute("data-motion-path");
    });

    const path = JSON.parse(
      firstActor.getAttribute("data-motion-path") ?? "{}"
    ) as { x?: number[]; y?: number[] };

    expect(path.x?.length).toBe(2);
    expect(path.y?.length).toBe(2);
    expect(
      path.x?.[0] !== path.x?.[1] || path.y?.[0] !== path.y?.[1]
    ).toBe(true);
    expect(screen.getByLabelText("First")).toBe(firstActor);
  });

  it("creates the preview actor in a zone when dragged from the modal", async () => {
    const user = userEvent.setup();

    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas);
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(screen.getByRole("textbox", { name: "Actor name" }), "Dragged Actor");
    const preview = screen.getByLabelText("Actor preview");
    fireEvent.pointerDown(preview, {
      button: 0,
      clientX: 500,
      clientY: 300,
      pointerId: 8,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      clientX: 510,
      clientY: 300,
      pointerId: 8,
      pointerType: "mouse"
    });
    expect(screen.queryByRole("dialog", { name: "Create actor" })).not.toBeInTheDocument();
    expect(document.querySelector('[data-actor-preview="true"]')).toBeInTheDocument();
    const dragPreview = screen.getByRole("status", { name: "Dragging Dragged Actor" });
    expect(dragPreview.querySelector("svg")).toBeInTheDocument();
    expect(dragPreview.querySelector("circle")).toBeInTheDocument();
    expect(dragPreview).toHaveTextContent("DRAGGED ACTOR");
    fireEvent.pointerUp(window, {
      clientX: 100,
      clientY: 100,
      pointerId: 8,
      pointerType: "mouse"
    });
    expect(document.querySelector('[data-actor-preview="true"]')).not.toBeInTheDocument();

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

    const actorElement = await screen.findByLabelText("Dragged Actor");
    const path = JSON.parse(
      actorElement.getAttribute("data-motion-path") ?? "{}"
    ) as { x?: number[]; y?: number[] };

    expect(path.x?.[0]).toBe(100);
    expect(path.y?.[0]).toBe(100);
    expect(path.x?.length).toBe(2);
    expect(path.y?.length).toBe(2);
  });

  it("creates an actor from a touch drag out of the creation dialog", async () => {
    const user = userEvent.setup();
    renderApp();
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Zone" }));
    createRectangleZone(canvas);
    await user.click(screen.getByRole("button", { name: "Actor" }));
    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(screen.getByRole("textbox", { name: "Actor name" }), "Touch Actor");
    const actorNameInput = screen.getByRole("textbox", { name: "Actor name" });
    const preview = screen.getByLabelText("Actor preview");

    fireEvent.pointerDown(preview, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 9,
      pointerType: "touch"
    });
    fireEvent.pointerMove(window, {
      clientX: 20,
      clientY: 10,
      pointerId: 9,
      pointerType: "touch"
    });
    // The focused name input must release the IME before the drag is handed
    // to the canvas; otherwise Android can leave the app viewport panned after
    // the modal unmounts.
    expect(document.activeElement).not.toBe(actorNameInput);
    expect(screen.queryByRole("dialog", { name: "Create actor" })).not.toBeInTheDocument();

    fireEvent.pointerUp(window, {
      clientX: 100,
      clientY: 100,
      pointerId: 9,
      pointerType: "touch"
    });

    await waitFor(() => {
      expect(
        Object.values(store.getState().encounter.present.actors.byId).some(
          (actor) => actor.name === "Touch Actor"
        )
      ).toBe(true);
    });
  });
});
