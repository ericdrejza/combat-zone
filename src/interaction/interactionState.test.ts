import { describe, expect, it } from "vitest";

import reducer, {
  finishBoxSelection,
  requestContextualAction,
  selectEntity,
  setActiveTool,
  setPolygonDraftPointIds,
  startBoxSelection
} from "./interactionState";
import { MVP_TOOLS } from "./tools/toolRegistry";

describe("interaction engine", () => {
  it("registers every MVP tool with a tooltip and interaction contract", () => {
    expect(MVP_TOOLS.map((tool) => tool.id)).toEqual([
      "select",
      "zone",
      "edge",
      "actor",
      "annotation",
      "background"
    ]);

    for (const tool of MVP_TOOLS) {
      expect(tool.tooltip.length).toBeGreaterThan(0);
      expect(tool.contract.clickBehavior.length).toBeGreaterThan(0);
      expect(tool.contract.dragBehavior.length).toBeGreaterThan(0);
      expect(tool.contract.keyboardShortcut.length).toBeGreaterThan(0);
    }
  });

  it("enforces tool-dependent selection scope and no cross-type selection", () => {
    let state = reducer(undefined, setActiveTool("actor"));

    state = reducer(
      state,
      selectEntity({
        entityType: "zone",
        ids: ["zone-1"]
      })
    );

    expect(state.selection.selectedIds).toEqual([]);

    state = reducer(
      state,
      selectEntity({
        entityType: "actor",
        ids: ["actor-1"]
      })
    );

    expect(state.selection).toMatchObject({
      selectedEntityType: "actor",
      selectedIds: ["actor-1"]
    });

    state = reducer(state, setActiveTool("zone"));

    expect(state.selection).toMatchObject({
      selectedEntityType: null,
      selectedIds: []
    });
  });

  it("toggles selection with shift-click semantics for the active entity type", () => {
    let state = reducer(undefined, setActiveTool("actor"));

    state = reducer(
      state,
      selectEntity({
        entityType: "actor",
        ids: ["actor-1"]
      })
    );
    state = reducer(
      state,
      selectEntity({
        entityType: "actor",
        ids: ["actor-2"],
        toggle: true
      })
    );

    expect(state.selection.selectedIds).toEqual(["actor-1", "actor-2"]);

    state = reducer(
      state,
      selectEntity({
        entityType: "actor",
        ids: ["actor-1"],
        toggle: true
      })
    );

    expect(state.selection.selectedIds).toEqual(["actor-2"]);
  });

  it("records ctrl-click contextual action requests without changing selection", () => {
    let state = reducer(undefined, setActiveTool("actor"));

    state = reducer(
      state,
      requestContextualAction({
        entityType: "actor",
        entityId: "actor-1"
      })
    );

    expect(state.selection.selectedIds).toEqual([]);
    expect(state.contextualActionRequest).toEqual({
      entityType: "actor",
      entityId: "actor-1",
      toolId: "actor"
    });
  });

  it("supports additive box selection and clears the box draft when finished", () => {
    let state = reducer(undefined, setActiveTool("zone"));

    state = reducer(
      state,
      selectEntity({
        entityType: "zone",
        ids: ["zone-1"]
      })
    );
    state = reducer(state, startBoxSelection({ x: 10, y: 10 }));
    state = reducer(
      state,
      finishBoxSelection({
        entityType: "zone",
        ids: ["zone-2", "zone-3"],
        additive: true
      })
    );

    expect(state.selection.selectedIds).toEqual(["zone-1", "zone-2", "zone-3"]);
    expect(state.draft.boxSelection).toBeNull();
  });

  it("clears stale interaction drafts when switching tools", () => {
    let state = reducer(undefined, setActiveTool("zone"));

    state = reducer(state, setPolygonDraftPointIds(["point-1", "point-2"]));
    state = reducer(state, startBoxSelection({ x: 10, y: 10 }));
    state = reducer(state, setActiveTool("actor"));

    expect(state.draft).toEqual({
      boxSelection: null,
      polygonPointIds: []
    });
  });
});
