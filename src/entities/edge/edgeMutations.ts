import type { EncounterState } from "@core/encounter/types";
import type { EntityCollection } from "@core/state/entityCollection";
import type {
  Edge,
  EdgeDirectionality,
  EdgeMovementRule,
  EdgeShape,
  EdgeVisibilityRule
} from "./types";

export type EdgePreset = {
  directionality: EdgeDirectionality;
  movementRules: EdgeMovementRule[];
  shape: EdgeShape;
  visibilityRule: EdgeVisibilityRule;
};

export type EdgeEditableProperties = Omit<EdgePreset, "directionality"> & {
  interactionTags?: string[];
  notes?: string;
};

export const DEFAULT_EDGE_PRESET: EdgePreset = {
  directionality: "bilateral",
  movementRules: [],
  shape: "straight",
  visibilityRule: "visible"
};

export function getEdgeSlotKey(
  fromZoneId: string,
  toZoneId: string,
  directionality: EdgeDirectionality
): string {
  if (directionality === "unilateral") {
    return `unilateral:${fromZoneId}->${toZoneId}`;
  }
  return `bilateral:${[fromZoneId, toZoneId].sort().join("<->")}`;
}

export function getEdgeForSlot(
  state: EncounterState,
  fromZoneId: string,
  toZoneId: string,
  directionality: EdgeDirectionality
): Edge | undefined {
  const slot = getEdgeSlotKey(fromZoneId, toZoneId, directionality);
  return state.edges.allIds
    .map((id) => state.edges.byId[id])
    .find(
      (edge): edge is Edge =>
        Boolean(edge) &&
        getEdgeSlotKey(edge.fromZoneId, edge.toZoneId, edge.directionality) === slot
    );
}

export function edgeMatchesPreset(edge: Edge, preset: EdgePreset): boolean {
  return (
    edge.directionality === preset.directionality &&
    edge.shape === preset.shape &&
    edge.visibilityRule === preset.visibilityRule &&
    edge.movementRules.length === preset.movementRules.length &&
    edge.movementRules.every((rule) => preset.movementRules.includes(rule))
  );
}

function replaceCollectionEdge(
  collection: EntityCollection<Edge>,
  removedId: string | undefined,
  edge: Edge
): EntityCollection<Edge> {
  const byId = { ...collection.byId };
  if (removedId) delete byId[removedId];
  byId[edge.id] = edge;
  const retainedIds = collection.allIds.filter((id) => id !== removedId);
  return { byId, allIds: [...retainedIds, edge.id] };
}

/** Creates an Edge or replaces the entity occupying its canonical pair slot. */
export function createOrReplaceEdge(
  state: EncounterState,
  input: EdgePreset & { id: string; fromZoneId: string; toZoneId: string }
): { nextEncounter: EncounterState; replacedEdge?: Edge; edge: Edge } {
  const replacedEdge = getEdgeForSlot(
    state,
    input.fromZoneId,
    input.toZoneId,
    input.directionality
  );
  const edge: Edge = {
    ...input,
    interactionTags: [],
    notes: undefined,
    movementRules: [...input.movementRules]
  };
  return {
    edge,
    replacedEdge,
    nextEncounter: {
      ...state,
      edges: replaceCollectionEdge(state.edges, replacedEdge?.id, edge)
    }
  };
}

export function updateEdges(
  state: EncounterState,
  edgeIds: string[],
  properties: Partial<EdgeEditableProperties>
): EncounterState {
  const targets = new Set(edgeIds);
  let changed = false;
  const byId = { ...state.edges.byId };
  for (const id of state.edges.allIds) {
    const edge = byId[id];
    if (!edge || !targets.has(id)) continue;
    byId[id] = {
      ...edge,
      ...properties,
      ...(properties.movementRules
        ? { movementRules: [...properties.movementRules] }
        : {})
    };
    changed = true;
  }
  return changed ? { ...state, edges: { ...state.edges, byId } } : state;
}

export function deleteEdges(
  state: EncounterState,
  edgeIds: readonly string[]
): EncounterState {
  const removed = new Set(edgeIds);
  if (!state.edges.allIds.some((id) => removed.has(id))) return state;
  const byId = { ...state.edges.byId };
  for (const id of removed) delete byId[id];
  return {
    ...state,
    edges: {
      byId,
      allIds: state.edges.allIds.filter((id) => !removed.has(id))
    }
  };
}

export function deleteAllEdges(state: EncounterState): EncounterState {
  return state.edges.allIds.length === 0
    ? state
    : { ...state, edges: { byId: {}, allIds: [] } };
}
