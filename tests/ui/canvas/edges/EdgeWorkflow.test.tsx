import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { buildZone } from "@entities/zone/zoneMutations";
import { createOrReplaceEdge, DEFAULT_EDGE_PRESET, updateEdges } from "@entities/edge/edgeMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { commitEncounterChange, undoEncounterChange } from "@store/encounterSlice";
import { store } from "@store/store";
import { getCanvas, mockCanvasBounds, renderApp } from "@tests/ui/renderApp";

function seedTwoZones() {
  const base = createEncounterState({ id: "edge-ui", name: "Edges" });
  const zone = (id: string, name: string, x: number) => buildZone({ id, name, polygon: [{ x, y: 100 }, { x: x + 120, y: 100 }, { x: x + 120, y: 220 }, { x, y: 220 }], shape: "rectangle" });
  store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.seed"), nextEncounter: { ...base, zones: { allIds: ["source", "target"], byId: { source: zone("source", "Source", 100), target: zone("target", "Target", 400) } } } }));
}

describe("Edge workflow", () => {
  it("shows defaults, resets sticky options, and creates an undoable bilateral edge by drag", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Edge" }));
    const tools = screen.getByRole("navigation", { name: "Tools" });
    expect(within(tools).getByRole("radio", { name: "Straight" }).querySelector(".lucide-move-right")).toBeInTheDocument();
    expect(within(tools).getByRole("radio", { name: "Right angled" }).querySelector(".lucide-corner-down-right")).toBeInTheDocument();
    expect(within(tools).getByRole("radio", { name: "Curved" }).querySelector(".lucide-spline")).toBeInTheDocument();
    expect(within(tools).getByRole("radio", { name: "Sigmoid" }).querySelector(".lucide-activity")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Bilateral" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(screen.getByRole("navigation", { name: "Tools" })).getByRole("button", { name: "Difficult" }));
    expect(screen.getByRole("button", { name: "Difficult" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Reset edge defaults" }));
    expect(screen.getByRole("button", { name: "Difficult" })).toHaveAttribute("aria-pressed", "false");

    const source = screen.getByLabelText("Source");
    const target = screen.getByLabelText("Target");
    fireEvent.mouseDown(source, { button: 0, clientX: 140, clientY: 140 });
    fireEvent.mouseMove(target, { clientX: 440, clientY: 140 });
    fireEvent.mouseUp(target, { clientX: 440, clientY: 140 });
    await waitFor(() => expect(store.getState().encounter.present.edges.allIds).toHaveLength(1));
    const edgeId = store.getState().encounter.present.edges.allIds[0];
    expect(store.getState().encounter.present.edges.byId[edgeId]).toMatchObject({ directionality: "bilateral", movementRules: [], shape: "straight", visibilityRule: "visible" });
    expect(screen.getByLabelText("bilateral edge from Source to Target")).toBeInTheDocument();
    const historyLength = store.getState().encounter.past.length;
    fireEvent.mouseDown(source, { button: 0, clientX: 140, clientY: 140 });
    fireEvent.mouseMove(target, { clientX: 440, clientY: 140 });
    fireEvent.mouseUp(target, { clientX: 440, clientY: 140 });
    await waitFor(() => expect(store.getState().interaction.selection.selectedIds).toEqual([edgeId]));
    expect(store.getState().encounter.past).toHaveLength(historyLength);
    await user.click(within(screen.getByRole("navigation", { name: "Tools" })).getByRole("button", { name: "Difficult" }));
    fireEvent.mouseDown(source, { button: 0, clientX: 140, clientY: 140 });
    fireEvent.mouseMove(target, { clientX: 440, clientY: 140 });
    fireEvent.mouseUp(target, { clientX: 440, clientY: 140 });
    await waitFor(() => expect(store.getState().encounter.present.edges.byId[edgeId]).toBeUndefined());
    expect(store.getState().encounter.present.edges.allIds).toHaveLength(1);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.edges.allIds).toEqual([edgeId]);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.edges.allIds).toEqual([]);
  });

  it("creates an edge from a touch drag when pointer capture keeps targeting the source Zone", async () => {
    renderApp();
    act(seedTwoZones);
    act(() => { store.dispatch(setActiveTool("edge")); });
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    const source = screen.getByLabelText("Source");
    const target = screen.getByLabelText("Target");
    const originalElementsFromPoint = document.elementsFromPoint;
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [target])
    });

    try {
      fireEvent.pointerDown(source, {
        button: 0,
        clientX: 140,
        clientY: 140,
        pointerId: 1,
        pointerType: "touch"
      });
      // Touch pointer capture keeps dispatching through the source element.
      fireEvent.pointerMove(source, {
        clientX: 440,
        clientY: 140,
        pointerId: 1,
        pointerType: "touch"
      });
      fireEvent.pointerUp(source, {
        clientX: 440,
        clientY: 140,
        pointerId: 1,
        pointerType: "touch"
      });

      await waitFor(() => {
        expect(store.getState().encounter.present.edges.allIds).toHaveLength(1);
      });
      expect(store.getState().encounter.present.edges.byId[
        store.getState().encounter.present.edges.allIds[0]
      ]).toMatchObject({ fromZoneId: "source", toZoneId: "target" });
    } finally {
      Object.defineProperty(document, "elementsFromPoint", {
        configurable: true,
        value: originalElementsFromPoint
      });
    }
  });

  it("batch edits selected edge rules through one undoable Properties action", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    const base = store.getState().encounter.present;
    const first = createOrReplaceEdge(base, { ...DEFAULT_EDGE_PRESET, fromZoneId: "source", id: "bilateral", toZoneId: "target" }).nextEncounter;
    const seeded = createOrReplaceEdge(first, { ...DEFAULT_EDGE_PRESET, directionality: "unilateral", fromZoneId: "source", id: "forward", toZoneId: "target" }).nextEncounter;
    act(() => {
      store.dispatch(commitEncounterChange({ action: createEncounterActionRecord("test.edges"), nextEncounter: seeded }));
      store.dispatch(setActiveTool("edge"));
      store.dispatch(selectEntity({ entityType: "edge", ids: ["bilateral", "forward"] }));
    });
    const properties = screen.getByLabelText("Properties panel");
    const difficultButton = within(properties).getByRole("button", { name: "Difficult" });
    const obscuredButton = within(properties).getByRole("radio", { name: "Obscured" });
    const straightButton = within(properties).getByRole("radio", { name: "Straight" });
    const rightAngleButton = within(properties).getByRole("radio", { name: "Right angled" });
    const curvedButton = within(properties).getByRole("radio", { name: "Curved" });
    const sigmoidButton = within(properties).getByRole("radio", { name: "Sigmoid" });
    expect(straightButton.querySelector(".lucide-move-right")).toBeInTheDocument();
    expect(rightAngleButton.querySelector(".lucide-corner-down-right")).toBeInTheDocument();
    expect(curvedButton.querySelector(".lucide-spline")).toBeInTheDocument();
    expect(sigmoidButton.querySelector(".lucide-activity")).toBeInTheDocument();
    expect(difficultButton.querySelector(".lucide-chevrons-down")).toBeInTheDocument();
    expect(obscuredButton.querySelector(".lucide-eye-dashed")).toBeInTheDocument();
    expect(within(getCanvas()).queryByLabelText(/visible visibility/)).not.toBeInTheDocument();
    await user.click(rightAngleButton);
    await waitFor(() => expect(store.getState().encounter.present.edges.allIds.every((id) => store.getState().encounter.present.edges.byId[id]?.shape === "rightAngled")).toBe(true));
    getCanvas().querySelectorAll('marker[id^="edge-arrow-end-"]').forEach((marker) => {
      expect(marker).toHaveAttribute("orient", "0");
    });
    getCanvas().querySelectorAll('marker[id^="edge-arrow-start-"]').forEach((marker) => {
      expect(marker).toHaveAttribute("orient", "180");
    });
    await user.click(difficultButton);
    await waitFor(() => expect(store.getState().encounter.present.edges.allIds.every((id) => store.getState().encounter.present.edges.byId[id]?.movementRules.includes("difficult"))).toBe(true));
    expect(getCanvas().querySelectorAll(".lucide-chevrons-down")).toHaveLength(2);
    expect(getCanvas().querySelector(".lucide-eye")).not.toBeInTheDocument();
    await user.click(obscuredButton);
    await waitFor(() => expect(getCanvas().querySelectorAll(".lucide-eye-dashed")).toHaveLength(2));
    const iconTooltips = [...getCanvas().querySelectorAll("[data-edge-badge-icon] title")]
      .map((title) => title.textContent);
    expect(iconTooltips).toEqual(expect.arrayContaining(["Difficult", "Obscured"]));
    expect(iconTooltips.every((tooltip) => (tooltip?.split(" ").length ?? 0) <= 2)).toBe(true);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.edges.byId.bilateral?.visibilityRule).toBe("visible");
    expect(store.getState().encounter.present.edges.byId.forward?.visibilityRule).toBe("visible");
  });

  it("summarizes a selected edge in the canvas tool status badge", () => {
    renderApp();
    act(seedTwoZones);
    const base = store.getState().encounter.present;
    const created = createOrReplaceEdge(base, {
      ...DEFAULT_EDGE_PRESET,
      fromZoneId: "source",
      id: "summary",
      movementRules: ["blocked", "skillCheck"],
      shape: "curved",
      toZoneId: "target",
      visibilityRule: "obscured"
    }).nextEncounter;
    const seeded = updateEdges(created, ["summary"], {
      interactionTags: ["door", "arcane"],
      notes: "Needs a key"
    });
    act(() => {
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("test.edgeSummary"),
        nextEncounter: seeded
      }));
      store.dispatch(setActiveTool("edge"));
      store.dispatch(selectEntity({ entityType: "edge", ids: ["summary"] }));
    });

    const status = screen.getByText(/Source: Source · Target: Target/);
    expect(status).toHaveTextContent("Movement: blocked, skill check");
    expect(status).toHaveTextContent("Visibility: obscured");
    expect(status).toHaveTextContent("Tags: door, arcane");
    expect(status).toHaveTextContent("Notes: Needs a key");
    expect(status).not.toHaveTextContent("curved");
  });

  it("edits discrete interaction tags and exposes tag and note details on the Edge", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    const created = createOrReplaceEdge(store.getState().encounter.present, {
      ...DEFAULT_EDGE_PRESET,
      fromZoneId: "source",
      id: "metadata",
      toZoneId: "target"
    }).nextEncounter;
    act(() => {
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("test.edgeMetadata"),
        nextEncounter: created
      }));
      store.dispatch(setActiveTool("edge"));
      store.dispatch(selectEntity({ entityType: "edge", ids: ["metadata"] }));
    });

    const properties = screen.getByLabelText("Properties panel");
    const tagInput = within(properties).getByRole("textbox", { name: "Add interaction tag" });
    await user.type(tagInput, "locked{Enter}arcane{Enter}");
    await waitFor(() => expect(store.getState().encounter.present.edges.byId.metadata?.interactionTags).toEqual(["locked", "arcane"]));
    expect(within(properties).getByRole("button", { name: "Remove tag locked" })).toHaveTextContent("locked");
    expect(within(properties).getByRole("button", { name: "Remove tag locked" }).querySelector(".lucide-x")).toHaveClass("opacity-0", "group-hover:opacity-100");

    const notes = within(properties).getByRole("textbox", { name: "Notes" });
    await user.type(notes, "Requires a silver key");
    await user.tab();
    await waitFor(() => expect(store.getState().encounter.present.edges.byId.metadata?.notes).toBe("Requires a silver key"));

    const canvas = getCanvas();
    const badgeIcons = [...canvas.querySelectorAll<SVGGElement>("[data-edge-badge-icon]")];
    expect(badgeIcons.map((icon) => icon.getAttribute("aria-label"))).toEqual(["Tags", "Notes"]);
    const tagHitTarget = badgeIcons[0]?.querySelector("[data-edge-badge-hit-target]");
    const notesHitTarget = badgeIcons[1]?.querySelector("[data-edge-badge-hit-target]");
    expect(tagHitTarget).toHaveAttribute("width", "18");
    fireEvent.pointerEnter(tagHitTarget!);
    const tagsTooltip = within(canvas).getByRole("tooltip", { name: "Tags tooltip" });
    expect(tagsTooltip).toHaveTextContent("locked");
    expect(tagsTooltip).toHaveTextContent("arcane");
    expect(within(tagsTooltip).queryByRole("button")).not.toBeInTheDocument();
    fireEvent.pointerLeave(tagHitTarget!);
    fireEvent.pointerEnter(notesHitTarget!);
    expect(within(canvas).getByRole("tooltip", { name: "Notes tooltip" })).toHaveTextContent("Requires a silver key");

    await user.click(within(properties).getByRole("button", { name: "Remove tag locked" }));
    await waitFor(() => expect(store.getState().encounter.present.edges.byId.metadata?.interactionTags).toEqual(["arcane"]));
  });

  it("tracks the cursor immediately before snapping to a target Zone", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Edge" }));
    fireEvent.mouseDown(screen.getByLabelText("Source"), { button: 0, clientX: 140, clientY: 140 });
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 300 });
    const preview = canvas.querySelector<SVGPathElement>('[data-edge-free-preview="true"]');
    expect(preview).toBeInTheDocument();
    expect(preview?.getAttribute("d")).toMatch(/299|300|301/);
    fireEvent.mouseUp(canvas, { clientX: 300, clientY: 300 });
  });

  it("spaces a target-snapped preview away from an established pair edge", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    const base = store.getState().encounter.present;
    const seeded = createOrReplaceEdge(base, {
      ...DEFAULT_EDGE_PRESET,
      fromZoneId: "source",
      id: "existing",
      toZoneId: "target"
    }).nextEncounter;
    act(() => {
      store.dispatch(commitEncounterChange({
        action: createEncounterActionRecord("test.previewSpacing"),
        nextEncounter: seeded
      }));
    });
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    await user.click(screen.getByRole("button", { name: "Edge" }));
    await user.click(screen.getByRole("radio", { name: "Unilateral" }));

    fireEvent.mouseDown(screen.getByLabelText("Source"), {
      button: 0,
      clientX: 140,
      clientY: 140
    });
    fireEvent.mouseMove(screen.getByLabelText("Target"), {
      clientX: 440,
      clientY: 140
    });

    await waitFor(() => {
      const routes = [
        screen.getByLabelText("bilateral edge from Source to Target"),
        screen.getByLabelText("unilateral edge from Source to Target")
      ];
      expect(new Set(routes.map((route) => route.getAttribute("d"))).size).toBe(2);
    });
    fireEvent.mouseUp(screen.getByLabelText("Target"), {
      clientX: 440,
      clientY: 140
    });
    await waitFor(() => {
      expect(store.getState().encounter.present.edges.allIds).toHaveLength(2);
    });
  });

  it("confirms clear-all and restores all edges with undo", async () => {
    const user = userEvent.setup();
    renderApp();
    act(seedTwoZones);
    act(() => { store.dispatch(setActiveTool("edge")); });
    const canvas = getCanvas();
    mockCanvasBounds(canvas);
    fireEvent.mouseDown(screen.getByLabelText("Source"), { button: 0, clientX: 140, clientY: 140 });
    fireEvent.mouseMove(screen.getByLabelText("Target"), { clientX: 440, clientY: 140 });
    fireEvent.mouseUp(screen.getByLabelText("Target"), { clientX: 440, clientY: 140 });
    await waitFor(() => expect(store.getState().encounter.present.edges.allIds).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Clear all edges" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm clear all edges" });
    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(store.getState().encounter.present.edges.allIds).toEqual([]);
    act(() => { store.dispatch(undoEncounterChange()); });
    expect(store.getState().encounter.present.edges.allIds).toHaveLength(1);
  });
});
