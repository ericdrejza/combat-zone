import type { LayoutPoint } from "@core/layout/types";
import { routeEdge } from "@entities/edge/edgeRouting";
import { resolveEdgeCurvePath } from "@entities/edge/resolveEdgeCurvePath";
import type { EdgeShape } from "@entities/edge/types";

export type EdgeFreePreviewInput = {
  fromPolygon: LayoutPoint[];
  obstaclePolygons: LayoutPoint[][];
  current: LayoutPoint;
  shape: EdgeShape;
  bounds: { x: number; y: number; width: number; height: number };
};
export type EdgeFreePreviewRequest = { requestId: number; input: EdgeFreePreviewInput };
export type EdgeFreePreviewResponse = { requestId: number; data?: string };

/** This transient pointer target never becomes an Edge endpoint or encounter state. */
export function calculateEdgeFreePreview(input: EdgeFreePreviewInput): string | undefined {
  const { current: point, fromPolygon, obstaclePolygons, bounds, shape } = input;
  const toPolygon = [
    { x: point.x - 1, y: point.y - 1 }, { x: point.x + 1, y: point.y - 1 },
    { x: point.x + 1, y: point.y + 1 }, { x: point.x - 1, y: point.y + 1 }
  ];
  const route = routeEdge({ bounds, fromPolygon, obstaclePolygons, shape, toPolygon });
  if (!route.valid) return undefined;
  return resolveEdgeCurvePath({ path: route.path, shape, bounds, clearance: route.clearance,
    polygons: [fromPolygon, ...obstaclePolygons], obstaclePolygons }).data || undefined;
}
