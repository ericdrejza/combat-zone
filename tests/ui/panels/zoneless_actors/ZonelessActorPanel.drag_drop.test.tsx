import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";

import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { setActiveTool } from "@interaction/interactionState";
import { COMPACT_LAYOUT_QUERY } from "@hooks/useCompactLayout";
import {
  redoEncounterChange,
  undoEncounterChange
} from "@store/encounterSlice";
import { store } from "@store/store";
import {
  getCanvas,
  mockCanvasBounds,
  renderApp
} from "@tests/ui/renderApp";
import { getZonelessActorTextPayload } from "@ui/panels/zoneless_actors/zonelessActorDrag";
import {
  actor,
  dataTransfer,
  dropOnCanvas,
  seedEncounter,
  zone
} from "./ZonelessActorPanel.test_support";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ZonelessActorPanel drag and drop", () => {
  it("moves a zoneless actor with a mouse pointer transfer", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      seedEncounter([
        {
          ...actor("actor-a", "Aegis"),
          image: { kind: "embedded", dataUrl: "data:image/png;base64,aegis" }
        }
      ], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    const actorButton = screen.getByRole("button", { name: "Aegis" });
    expect(actorButton).toHaveAttribute("draggable", "false");

    fireEvent.pointerDown(actorButton, {
      button: 0,
      clientX: 500,
      clientY: 300,
      pointerId: 21,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      clientX: 510,
      clientY: 300,
      pointerId: 21,
      pointerType: "mouse"
    });
    const transferPreview = screen.getByRole("status", {
      name: "Dragging 1 actor"
    });
    expect(transferPreview.querySelector("svg")).toBeInTheDocument();
    expect(transferPreview.querySelector("image")).toHaveAttribute(
      "href",
      "data:image/png;base64,aegis"
    );
    fireEvent.pointerUp(window, {
      clientX: 120,
      clientY: 120,
      pointerId: 21,
      pointerType: "mouse"
    });

    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe("zone-target");
  });

  it("continues a touch transfer after the compact zoneless drawer closes", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: query === COMPACT_LAYOUT_QUERY,
      media: query,
      onchange: null,
      removeEventListener: vi.fn()
    }));

    try {
      renderApp();
      act(() => {
        seedEncounter([
          {
            ...actor("actor-a", "Aegis"),
            image: { kind: "embedded", dataUrl: "data:image/png;base64,compact-aegis" }
          }
        ], [zone()]);
        store.dispatch(setActiveTool("actor"));
      });
      const canvas = getCanvas();
      mockCanvasBounds(canvas);
      const libraryLauncher = screen.getByRole("button", {
        name: "Library panel"
      });
      fireEvent.keyDown(libraryLauncher, { key: "ArrowDown" });
      fireEvent.click(screen.getByRole("menuitem", { name: "Zoneless" }));

      const zonelessLauncher = screen.getByRole("button", {
        name: "Zoneless panel"
      });
      fireEvent.pointerDown(zonelessLauncher, { button: 0, pointerId: 30 });
      fireEvent.pointerUp(zonelessLauncher, { pointerId: 30 });
      expect(
        screen.getByRole("dialog", { name: "Zoneless panel" })
      ).toBeInTheDocument();

      const actorButton = screen.getByRole("button", { name: "Aegis" });
      fireEvent.pointerDown(actorButton, {
        button: 0,
        clientX: 500,
        clientY: 300,
        pointerId: 31,
        pointerType: "touch"
      });
      fireEvent.pointerMove(window, {
        clientX: 510,
        clientY: 300,
        pointerId: 31,
        pointerType: "touch"
      });

      expect(
        screen.queryByRole("dialog", { name: "Zoneless panel" })
      ).not.toBeInTheDocument();
      const transferPreview = screen.getByRole("status", {
        name: "Dragging 1 actor"
      });
      expect(transferPreview.querySelector("image")).toHaveAttribute(
        "href",
        "data:image/png;base64,compact-aegis"
      );
      fireEvent.pointerUp(window, {
        clientX: 120,
        clientY: 120,
        pointerId: 31,
        pointerType: "touch"
      });

      expect(
        store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
      ).toBe("zone-target");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("creates a new actor when the actor preview is dropped into the panel", async () => {
    const user = userEvent.setup();

    renderApp();
    act(() => {
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(screen.getByRole("button", { name: "Create actor" }));
    await user.type(
      screen.getByRole("textbox", { name: "Actor name" }),
      "Dropped Actor"
    );
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    const preview = screen.getByLabelText("Actor preview");

    fireEvent.pointerDown(preview, {
      button: 0,
      clientX: 500,
      clientY: 300,
      pointerId: 10,
      pointerType: "mouse"
    });
    fireEvent.pointerMove(window, {
      clientX: 510,
      clientY: 300,
      pointerId: 10,
      pointerType: "mouse"
    });
    expect(
      screen.queryByRole("dialog", { name: "Create actor" })
    ).not.toBeInTheDocument();
    fireEvent.pointerUp(window, {
      clientX: 700,
      clientY: 500,
      pointerId: 10,
      pointerType: "mouse"
    });

    const createdActor = Object.values(
      store.getState().encounter.present.actors.byId
    ).find((candidate) => candidate.name === "Dropped Actor");
    expect(createdActor?.currentZoneId).toBe(ZONELESS_ACTOR_ZONE_ID);
    expect(store.getState().encounter.past.at(-1)?.action.type).toBe(
      "actor.create"
    );

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(
      Object.values(store.getState().encounter.present.actors.byId).some(
        (candidate) => candidate.name === "Dropped Actor"
      )
    ).toBe(false);

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(
      Object.values(store.getState().encounter.present.actors.byId).some(
        (candidate) =>
          candidate.name === "Dropped Actor" &&
          candidate.currentZoneId === ZONELESS_ACTOR_ZONE_ID
      )
    ).toBe(true);
  });

  it("moves selected panel actors into a zone and restores them with undo/redo", async () => {
    const user = userEvent.setup();
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis"), actor("actor-b", "Borin")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );
    await user.click(screen.getByRole("button", { name: "Aegis" }));
    fireEvent.click(screen.getByRole("button", { name: "Borin" }), {
      shiftKey: true
    });

    const firstActor = screen.getByRole("button", { name: "Aegis" });
    fireEvent.dragStart(firstActor, { dataTransfer: transfer });
    expect(store.getState().interaction.activeToolId).toBe("actor");
    expect(transfer.types).toContain("application/x-combat-zone-zoneless-actors");
    expect(transfer.getData("application/x-combat-zone-zoneless-actors")).toBe(
      "actor-a,actor-b"
    );
    expect(transfer.getData("text/plain")).toBe(
      getZonelessActorTextPayload(["actor-a", "actor-b"])
    );

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, { clientX: 120, clientY: 120, dataTransfer: transfer });
    dropOnCanvas(canvas, transfer, 120, 120);

    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      "zone-target"
    );
    expect(store.getState().encounter.present.actors.byId["actor-b"]?.currentZoneId).toBe(
      "zone-target"
    );
    const movedAegis = await screen.findByLabelText("Aegis");
    const movedBorin = await screen.findByLabelText("Borin");

    [movedAegis, movedBorin].forEach((actorElement) => {
      const path = JSON.parse(
        actorElement.getAttribute("data-motion-path") ?? "{}"
      ) as { x?: number[]; y?: number[] };

      expect(path.x?.[0]).toBe(120);
      expect(path.y?.[0]).toBe(120);
      expect(path.x?.length).toBe(2);
      expect(path.y?.length).toBe(2);
    });

    act(() => {
      store.dispatch(undoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
    expect(store.getState().encounter.present.actors.byId["actor-b"]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );

    act(() => {
      store.dispatch(redoEncounterChange());
    });
    expect(store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId).toBe(
      "zone-target"
    );
  });

  it("accepts a panel drop when the nested SVG zone target stops bubbling", async () => {
    const user = userEvent.setup();
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const actorButton = screen.getByRole("button", { name: "Aegis" });
    fireEvent.dragStart(actorButton, { dataTransfer: transfer });

    const zoneElement = screen.getByLabelText("Target");
    zoneElement.addEventListener("dragover", (event) => event.stopPropagation());
    zoneElement.addEventListener("drop", (event) => event.stopPropagation());

    fireEvent.dragOver(zoneElement, {
      clientX: 120,
      clientY: 120,
      dataTransfer: transfer
    });
    dropOnCanvas(zoneElement, transfer, 120, 120);

    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe("zone-target");
  });

  it("accepts a panel drop when only the standard text drag payload is available", async () => {
    const dragOverTransfer = {
      dropEffect: "none",
      effectAllowed: "move",
      getData: () => "",
      types: ["text/plain"]
    };
    const dropTransfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });

    dropTransfer.setData(
      "text/plain",
      getZonelessActorTextPayload(["actor-a"])
    );

    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, {
      clientX: 120,
      clientY: 120,
      dataTransfer: dragOverTransfer
    });
    expect(dragOverTransfer.dropEffect).toBe("move");
    dropOnCanvas(canvas, dropTransfer, 120, 120);

    expect(
      store.getState().encounter.present.actors.byId["actor-a"]?.currentZoneId
    ).toBe("zone-target");
  });

  it("does not create history when a panel actor is dropped outside a zone", async () => {
    const user = userEvent.setup();
    const transfer = dataTransfer();

    renderApp();
    act(() => {
      seedEncounter([actor("actor-a", "Aegis")], [zone()]);
      store.dispatch(setActiveTool("actor"));
    });
    await user.click(
      screen.getByRole("button", { name: "Expand zoneless actors" })
    );

    const before = store.getState().encounter;
    const actorButton = screen.getByRole("button", { name: "Aegis" });
    fireEvent.dragStart(actorButton, { dataTransfer: transfer });
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.dragOver(canvas, { clientX: 700, clientY: 500, dataTransfer: transfer });
    dropOnCanvas(canvas, transfer, 700, 500);

    expect(store.getState().encounter.present).toEqual(before.present);
    expect(store.getState().encounter.past).toHaveLength(before.past.length);
  });

});
