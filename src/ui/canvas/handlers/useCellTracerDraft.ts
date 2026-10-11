import { useEffect, useRef } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { buildCellGraph, traceCellRoute } from '@core/movement/cellTracer';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';

/** Segment lengths preserve user checkpoints independently of inserted route turns. */
export function useCellTracerDraft(state: EncounterState, active: boolean, points: LayoutPoint[], setPoints: (points: LayoutPoint[]) => void) {
  const checkpoints = useRef<number[]>([]), graph = useRef<ReturnType<typeof buildCellGraph>>();
  useEffect(() => { const hadPoints = checkpoints.current.length > 0; checkpoints.current = []; graph.current = undefined; if (active || hadPoints) setPoints([]); }, [active, state.grid, state.movementRules.snapZoneVertices]);
  if (!points.length) checkpoints.current = [];
  function append(point: LayoutPoint, closing = false): LayoutPoint[] | null {
    const snapped = nearestGridVertex(state, point);
    if (!points.length) { checkpoints.current.push(0); return [snapped]; }
    if (!graph.current) graph.current = buildCellGraph(state);
    const route = traceCellRoute(state, points[points.length - 1], snapped, points, readCanvasPreferences().tracerInvalidRoute, closing, graph.current);
    if (!route || route.length < 2) return null;
    const next = [...points, ...route.slice(1)];
    if (closing) next.pop(); else checkpoints.current.push(points.length);
    return next;
  }
  function remove() { const length = checkpoints.current.pop(); setPoints(points.slice(0, length ?? Math.max(0, points.length - 1))); }
  return { append, remove };
}
