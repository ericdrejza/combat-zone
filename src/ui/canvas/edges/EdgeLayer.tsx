import { usePlayerAudience, useSceneId } from '@ui/player_view/PlayerSceneSource';
import { useCanvasPreferences } from "@ui/canvas_preferences/useCanvasPreferences";
import { useEdgeRoutes } from "./useEdgeRoutes";
import { useMemo } from "react";
import { snapZonePolygon } from "@core/movement/zoneVertexSnapping";
import { pendingEdgeRoute, temporaryEdgeRoute } from "./temporaryEdgeRoute";
import { useEdgeFreePreview } from "./useEdgeFreePreview";
import type { EdgeFreePreviewInput } from "./edgeFreePreview";
import { resolveEdgeCurvePath } from "@entities/edge/resolveEdgeCurvePath";
import { isPointInPolygon } from "@core/layout/polygonGeometry";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { getDefaultEdgePath } from "@entities/edge/edgePathGeometry";
import { motion } from "motion/react";
import { useSelectionOutlineMode } from "@ui/canvas/useSelectionOutlineMode";

import type { LayoutPoint } from "@core/layout/types";
import { getEdgeSlotKey, type EdgePreset } from "@entities/edge/edgeMutations";
import {
  getEdgeLanePlacement,
  offsetRouteForLane,
  pointAlongRoute,
  routeEdge,
} from "@entities/edge/edgeRouting";
import type { Edge, EdgeRoutePreferences } from "@entities/edge/types";
import type { Zone } from "@entities/zone/types";
import type { RootState } from "@store/store";
import type { EdgeDragState } from "../canvasInteractionTypes";
import { getTextColorForLuminance } from "../canvasLuminance";
import { EdgeRouteVisual } from "./EdgeRouteVisual";

type Props = {
  activeToolId: string;
  directManipulationZoneId?: string | null;
  zoneEditPending?: boolean;
  edgeDrag: EdgeDragState | null;
  edgeTool: EdgePreset;
  encounter: RootState["encounter"]["present"];
  canvasBackgroundLuminance: number;
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  selection: RootState["interaction"]["selection"];
};

function pairKey(edge: Pick<Edge, "fromZoneId" | "toZoneId">) {
  return [edge.fromZoneId, edge.toZoneId].sort().join("<->");
}

export function EdgeLayer({ activeToolId, directManipulationZoneId = null, zoneEditPending = false, edgeDrag, edgeTool, encounter, canvasBackgroundLuminance, getDisplayedPolygon, selection }: Props) {
  const player = usePlayerAudience();
  const markerPrefix = useSceneId('');
  const { edgeThickness } = useInterfacePreferences();
  const { preferences } = useCanvasPreferences();
  const selectionMode = useSelectionOutlineMode("edge");
  const committedPolygons = useMemo(() => Object.fromEntries(encounter.zones.allIds
    .map(id => encounter.zones.byId[id]).filter((zone): zone is Zone => Boolean(zone))
    .map(zone => [zone.id, snapZonePolygon(encounter, zone)])),
  [encounter.zones, encounter.grid, encounter.movementRules.snapZoneVertices, encounter.canvasSize]);
  const displayedPolygons = Object.fromEntries(encounter.zones.allIds
    .map(id => encounter.zones.byId[id]).filter((zone): zone is Zone => Boolean(zone))
    .map(zone => [zone.id, getDisplayedPolygon(zone)]));
  const edges = useMemo(() => encounter.edges.allIds.map((id) => encounter.edges.byId[id]).filter((edge): edge is Edge => Boolean(edge)), [encounter.edges]);
  const previewEdge: Edge | undefined = edgeDrag?.targetZoneId ? {
    ...edgeTool,
    fromZoneId: edgeDrag.sourceZoneId,
    id: "edge-preview",
    interactionTags: [],
    toZoneId: edgeDrag.targetZoneId
  } : undefined;
  const previewSlot = previewEdge
    ? getEdgeSlotKey(
        previewEdge.fromZoneId,
        previewEdge.toZoneId,
        previewEdge.directionality
      )
    : undefined;
  const groupedEdges = previewEdge
    ? [
        ...edges.filter((edge) => getEdgeSlotKey(
          edge.fromZoneId,
          edge.toZoneId,
          edge.directionality
        ) !== previewSlot),
        previewEdge
      ]
    : edges;
  const groups = new Map<string, Edge[]>();
  groupedEdges.forEach((edge) => groups.set(pairKey(edge), [...(groups.get(pairKey(edge)) ?? []), edge]));

  const { routes, pending } = useEdgeRoutes({
    encounterId: encounter.id,
    state: { canvasSize: encounter.canvasSize, grid: encounter.grid, movementRules: encounter.movementRules },
    polygons: directManipulationZoneId || zoneEditPending ? displayedPolygons : committedPolygons,
    edges, preview: previewEdge, estimateOnly: preferences.edgeRoutingDuringDrag !== "live"
  }, Boolean(directManipulationZoneId) || zoneEditPending);
  const reservedFor = (edge: Edge) => Object.entries(routes).filter(([id, route]) => id !== edge.id && route.route.gridAligned && pairKey(route) === pairKey(edge)).map(([, route]) => route.route.path);
  function renderEdge(edge: Edge, preview = false) {
    const from = encounter.zones.byId[edge.fromZoneId];
    const to = encounter.zones.byId[edge.toZoneId];
    if (!from || !to) return null;
    const obstacles = encounter.zones.allIds
      .filter((id) => id !== from.id && id !== to.id)
      .map((id) => encounter.zones.byId[id])
      .filter((zone): zone is Zone => Boolean(zone))
      .map(zone => displayedPolygons[zone.id]);
    const siblings = groups.get(pairKey(edge)) ?? [edge];
    const lane = getEdgeLanePlacement(edge, siblings);
    const fromPolygon = displayedPolygons[from.id], toPolygon = displayedPolygons[to.id];
    const cached = routes[edge.id];
    const matching = cached?.fromZoneId === edge.fromZoneId && cached.toZoneId === edge.toZoneId ? cached : undefined;
    const completed = matching ?? (pending ? pendingEdgeRoute(edge, fromPolygon, toPolygon, lane.badgeFraction) : undefined);
    if (!completed) return null;
    const { route } = completed;
    const { path, data: d } = temporaryEdgeRoute(completed, fromPolygon, toPolygon);
    const basePath = route.path;
    const space = {
      bounds: { x: 0, y: 0, ...encounter.canvasSize },
      polygons: [fromPolygon, toPolygon, ...obstacles], obstaclePolygons: obstacles, clearance: route.clearance
    };
    const renderable = route.valid && Boolean(d);
    const getPath = (preferences: EdgeRoutePreferences) => {
      const candidate = routeEdge({ laneOffset: lane.routeOffset, gridState: encounter, reservedGridPaths: reservedFor(edge), bounds: { x: 0, y: 0, ...encounter.canvasSize }, fromPolygon, toPolygon, obstaclePolygons: obstacles, shape: edge.shape, flipped: preferences.flipped });
      if (!candidate.valid) return undefined;
      const adjusted = offsetRouteForLane(candidate.path, fromPolygon, toPolygon, Math.sign(lane.routeOffset) * Math.min(Math.abs(lane.routeOffset), candidate.clearance));
      return resolveEdgeCurvePath({ ...space, clearance: candidate.clearance, path: adjusted,
        shape: edge.shape, preferences, allowFallback: false }).data || undefined;
    };
    const edgeColor = renderable
      ? edge.color ?? getTextColorForLuminance(canvasBackgroundLuminance)
      : "#dc2626";
    const selected = !player && selection.selectedEntityType === "edge" && selection.selectedIds.includes(edge.id);
    const badgePoint = pointAlongRoute(path, lane.badgeFraction);
    const dash = !renderable ? "4 4" : edge.visibilityRule === "obscured" ? "10 6" : edge.visibilityRule === "hidden" ? "3 5" : undefined;
    const markerStart = edge.directionality === "bilateral"
      ? `url(#${markerPrefix}edge-arrow-start-${edge.id})`
      : undefined;
    return (
      <g key={edge.id} data-edge-route-valid={renderable} data-edge-route-pending={pending}>
        {d ? <EdgeRouteVisual
          edge={edge} pathData={d} edgeColor={edgeColor} dash={dash}
          markerStart={markerStart} fromName={from.name} toName={to.name}
          routePending={pending} gridAligned={route.gridAligned} preview={preview} selected={selected} selectionMode={selectionMode}
          badgeFraction={completed.badgeFraction} fallbackBadgePoint={badgePoint}
          editable={!player && activeToolId === "edge" && selected && !preview && renderable && !completed.automatic && !pending}
          curvaturePolygons={[fromPolygon, toPolygon]} getPath={getPath} baselineData={getDefaultEdgePath(path, edge.shape)}
          curveSpace={space}
        /> : null}
        {
          !renderable
          ? <g aria-label="Edge route unavailable">
            <circle cx={basePath[0]?.x ?? displayedPolygons[from.id][0]?.x} cy={basePath[0]?.y ?? displayedPolygons[from.id][0]?.y} fill="#dc2626" r="5" />
            <circle cx={basePath.at(-1)?.x ?? displayedPolygons[to.id][0]?.x} cy={basePath.at(-1)?.y ?? displayedPolygons[to.id][0]?.y} fill="#dc2626" r="5" />
          </g> 
          : null
        }
      </g>
    );
  }

  let freeInput: EdgeFreePreviewInput | null = null;
  if (edgeDrag && !edgeDrag.targetZoneId) {
    const source = encounter.zones.byId[edgeDrag.sourceZoneId];
    if (source && !isPointInPolygon(edgeDrag.current, displayedPolygons[source.id])) {
      freeInput = {
        current: edgeDrag.current, fromPolygon: displayedPolygons[source.id], shape: edgeTool.shape,
        bounds: { x: 0, y: 0, ...encounter.canvasSize },
        obstaclePolygons: encounter.zones.allIds.filter(id => id !== source.id)
          .map(id => encounter.zones.byId[id]).filter((zone): zone is Zone => Boolean(zone)).map(zone => displayedPolygons[zone.id])
      };
    }
  }
  const freePreview = useEdgeFreePreview(freeInput);
  const edgeColor = getTextColorForLuminance(canvasBackgroundLuminance);
  return <>
    {edges.map((edge) => renderEdge(edge))}
    {!player && activeToolId === "edge" && previewEdge ? renderEdge(previewEdge, true) : null}
    {!player && freePreview ? <g className="pointer-events-none opacity-60"><defs><marker id="edge-preview-arrow" markerUnits="userSpaceOnUse" viewBox="0 0 8 8" markerHeight={8 * edgeThickness} markerWidth={8 * edgeThickness} orient="auto-start-reverse" refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={edgeColor} /></marker></defs><motion.path className="fill-none" d={freePreview} data-edge-free-preview="true" initial={false} markerEnd="url(#edge-preview-arrow)" markerStart={edgeTool.directionality === "bilateral" ? "url(#edge-preview-arrow)" : undefined} stroke={edgeColor} strokeDasharray="6 5" strokeWidth={edgeThickness + 1} /></g> : null}
  </>;
}
