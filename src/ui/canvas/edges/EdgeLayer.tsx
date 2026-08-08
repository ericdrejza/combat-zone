import { motion } from "motion/react";

import type { LayoutPoint } from "@core/layout/types";
import { getEdgeSlotKey, type EdgePreset } from "@entities/edge/edgeMutations";
import {
  getEdgeLanePlacement,
  getCardinalPathArrowAngle,
  offsetRouteForLane,
  pointAlongRoute,
  routeEdge,
  routeToSvgPath
} from "@entities/edge/edgeRouting";
import type { Edge } from "@entities/edge/types";
import type { Zone } from "@entities/zone/types";
import type { RootState } from "@store/store";
import type { EdgeDragState } from "../canvasInteractionTypes";
import { getTextColorForLuminance } from "../canvasLuminance";
import { EdgeBadges } from "./EdgeBadges";

const routeCache = new Map<string, LayoutPoint[]>();

type Props = {
  activeToolId: string;
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

export function EdgeLayer({ activeToolId, edgeDrag, edgeTool, encounter, canvasBackgroundLuminance, getDisplayedPolygon, selection }: Props) {
  const edges = encounter.edges.allIds.map((id) => encounter.edges.byId[id]).filter((edge): edge is Edge => Boolean(edge));
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

  function renderEdge(edge: Edge, preview = false) {
    const from = encounter.zones.byId[edge.fromZoneId];
    const to = encounter.zones.byId[edge.toZoneId];
    if (!from || !to) return null;
    const obstacles = encounter.zones.allIds
      .filter((id) => id !== from.id && id !== to.id)
      .map((id) => encounter.zones.byId[id])
      .filter((zone): zone is Zone => Boolean(zone))
      .map(getDisplayedPolygon);
    const route = routeEdge({ fromPolygon: getDisplayedPolygon(from), obstaclePolygons: obstacles, shape: edge.shape, toPolygon: getDisplayedPolygon(to) });
    const slotKey = getEdgeSlotKey(edge.fromZoneId, edge.toZoneId, edge.directionality);
    if (route.valid) routeCache.set(slotKey, route.path);
    const basePath = route.valid ? route.path : routeCache.get(slotKey) ?? [];
    const siblings = groups.get(pairKey(edge)) ?? [edge];
    const lane = getEdgeLanePlacement(edge, siblings);
    const safeLane = Math.sign(lane.routeOffset) * Math.min(
      Math.abs(lane.routeOffset),
      route.valid ? route.clearance : Math.abs(lane.routeOffset)
    );
    const fromPolygon = getDisplayedPolygon(from);
    const toPolygon = getDisplayedPolygon(to);
    const path = offsetRouteForLane(
      basePath,
      fromPolygon,
      toPolygon,
      safeLane
    );
    const d = routeToSvgPath(path, edge.shape);
    const edgeColor = route.valid
      ? getTextColorForLuminance(canvasBackgroundLuminance)
      : "#dc2626";
    const selected = selection.selectedEntityType === "edge" && selection.selectedIds.includes(edge.id);
    const badgePoint = pointAlongRoute(path, lane.badgeFraction);
    const dash = !route.valid ? "4 4" : edge.visibilityRule === "obscured" ? "10 6" : edge.visibilityRule === "hidden" ? "3 5" : undefined;
    const end = path[path.length - 1];
    const beforeEnd = path[path.length - 2];
    const start = path[0];
    const afterStart = path[1];
    const cardinalEndAngle = edge.shape === "rightAngled" && end && beforeEnd
      ? getCardinalPathArrowAngle({
          x: end.x - beforeEnd.x,
          y: end.y - beforeEnd.y
        })
      : undefined;
    const cardinalStartAngle = edge.shape === "rightAngled" && start && afterStart
      ? getCardinalPathArrowAngle({
          x: start.x - afterStart.x,
          y: start.y - afterStart.y
        })
      : undefined;
    const markerStart = edge.directionality === "bilateral"
      ? `url(#edge-arrow-start-${edge.id})`
      : undefined;
    return (
      <g key={edge.id} data-edge-route-valid={route.valid}>
        <defs>
          <marker id={`edge-arrow-end-${edge.id}`} markerHeight="8" markerWidth="8" orient={cardinalEndAngle ?? "auto"} refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={edgeColor} /></marker>
          <marker id={`edge-arrow-start-${edge.id}`} markerHeight="8" markerWidth="8" orient={cardinalStartAngle ?? "auto-start-reverse"} refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={edgeColor} /></marker>
        </defs>
        {d ? <>
          <motion.path 
            animate={{ d }} 
            aria-label={`${edge.directionality} edge from ${from.name} to ${to.name}`} 
            className={
              `${preview ? "pointer-events-none opacity-60" : "cursor-pointer"} 
              fill-none`
            } 
            data-entity-id={preview ? undefined : edge.id} 
            data-entity-type={preview ? undefined : "edge"} 
            initial={false} 
            markerEnd={`url(#edge-arrow-end-${edge.id})`}
            markerStart={markerStart} 
            stroke={edgeColor}
            strokeDasharray={dash} 
            strokeWidth={selected ? 2 : 1} 
          />
          {!preview && <path className="cursor-pointer fill-none stroke-transparent" d={d} data-entity-id={edge.id} data-entity-type="edge" strokeWidth={14} />}
          {badgePoint && !preview ? <EdgeBadges edge={edge} edgeColor={edgeColor} point={badgePoint} /> : null}
        </> : null}
        {
          !route.valid 
          ? <g aria-label="Edge route unavailable">
            <circle cx={basePath[0]?.x ?? getDisplayedPolygon(from)[0]?.x} cy={basePath[0]?.y ?? getDisplayedPolygon(from)[0]?.y} fill="#dc2626" r="5" />
            <circle cx={basePath.at(-1)?.x ?? getDisplayedPolygon(to)[0]?.x} cy={basePath.at(-1)?.y ?? getDisplayedPolygon(to)[0]?.y} fill="#dc2626" r="5" />
          </g> 
          : null
        }
      </g>
    );
  }

  let freePreview: string | undefined;
  if (edgeDrag && !edgeDrag.targetZoneId) {
    const source = encounter.zones.byId[edgeDrag.sourceZoneId];
    if (source) {
      const point = edgeDrag.current;
      const target = [
        { x: point.x - 1, y: point.y - 1 },
        { x: point.x + 1, y: point.y - 1 },
        { x: point.x + 1, y: point.y + 1 },
        { x: point.x - 1, y: point.y + 1 }
      ];
      const obstaclePolygons = encounter.zones.allIds
        .filter((id) => id !== source.id)
        .map((id) => encounter.zones.byId[id])
        .filter((zone): zone is Zone => Boolean(zone))
        .map(getDisplayedPolygon);
      const route = routeEdge({ fromPolygon: getDisplayedPolygon(source), obstaclePolygons, shape: edgeTool.shape, toPolygon: target });
      freePreview = routeToSvgPath(route.path, edgeTool.shape);
    }
  }
  const edgeColor = getTextColorForLuminance(canvasBackgroundLuminance);
  return <>
    {edges.map((edge) => renderEdge(edge))}
    {activeToolId === "edge" && previewEdge ? renderEdge(previewEdge, true) : null}
    {freePreview ? <g className="pointer-events-none opacity-60"><defs><marker id="edge-preview-arrow" markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4"><path d="M 0 0 L 8 4 L 0 8 z" fill={edgeColor} /></marker></defs><motion.path className="fill-none" d={freePreview} data-edge-free-preview="true" initial={false} markerEnd="url(#edge-preview-arrow)" markerStart={edgeTool.directionality === "bilateral" ? "url(#edge-preview-arrow)" : undefined} stroke={edgeColor} strokeDasharray="6 5" strokeWidth={2} /></g> : null}
  </>;
}
