import { edgeGeometryKey } from "./edgeGeometryKey";
import type { LayoutPoint } from "@core/layout/types";
import { adjustEdgeCurve } from "./edgeCurveGeometry";
import { getDefaultEdgePath, routeToSvgPath } from "./edgePathGeometry";
import { getRoundedEdgePath, isEdgePathClear } from "./edgePathCollision";
import type { EdgeRoutePreferences, EdgeShape } from "./types";

type Input = {
  path: LayoutPoint[];
  shape: EdgeShape;
  preferences?: EdgeRoutePreferences;
  polygons: LayoutPoint[][];
  obstaclePolygons: LayoutPoint[][];
  clearance: number;
  bounds: { x: number; y: number; width: number; height: number };
  allowFallback?: boolean;
  automaticCurvatureLimit?: number;
};

type Result = { data: string; automatic: boolean };
const cache = new Map<string, Result>();

/** Reuse collision results until geometry, preferences, or routing constraints change. */
export function resolveEdgeCurvePath(input: Input): Result {
  const key = JSON.stringify([input.path, input.shape, input.preferences, edgeGeometryKey(input.polygons), edgeGeometryKey(input.obstaclePolygons), input.clearance, input.bounds, input.allowFallback, input.automaticCurvatureLimit]);
  const cached = cache.get(key);
  if (cached) return cached;
  const result = resolve(input);
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}

/** Manual bounds are secondary to keeping automatic curves outside moving Zones. */
function resolve(input: Input): Result {
  const preferred = routeToSvgPath(input.path, input.shape, input.preferences, input.polygons.slice(0, 2));
  if (input.shape !== "curved" && input.shape !== "sigmoid") return { data: preferred, automatic: false };
  const checked = new Map<string, boolean>();
  const clear = (data: string) => {
    const cached = checked.get(data);
    if (cached !== undefined) return cached;
    const result = isEdgePathClear(data, input);
    checked.set(data, result);
    return result;
  };
  if (clear(preferred)) return { data: preferred, automatic: false };
  if (input.allowFallback === false) return { data: "", automatic: false };
  const baseline = getDefaultEdgePath(input.path, input.shape);
  // Try reducing the bend before increasing it; boundary search can restrict
  // this pass so a farther border attachment wins over an exaggerated curve.
  for (const curvature of [1, 0.75, 0.5, 0.25, 0.125, 0.0625, 0, 1.5, 2, 3, 4, 8, 16]) {
    if (curvature > (input.automaticCurvatureLimit ?? Infinity)) continue;
    for (const flipped of [false, true]) {
      const data = adjustEdgeCurve(baseline, { flipped, curvature });
      if (clear(data)) return { data, automatic: true };
    }
  }
  for (const fraction of input.path.length === 2 ? [0.5] : [0.5, 0.35, 0.2, 0.1, 0.05, 0.01, 0.001, 0.0001, 0.00001, 0.000001]) {
    const data = getRoundedEdgePath(input.path, fraction);
    if (clear(data)) return { data, automatic: true };
  }
  return { data: "", automatic: true };
}
