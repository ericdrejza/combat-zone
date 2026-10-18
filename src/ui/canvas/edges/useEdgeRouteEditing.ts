import { getEdgeCurvatureMaximum } from "@entities/edge/edgeCurvatureLimits";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cancelFrame, frame } from "motion/react";
import { useStore } from "react-redux";
import { isEdgePathClear, type PathSpace } from "@entities/edge/edgePathCollision";
import type { LayoutPoint } from "@core/layout/types";
import { adjustEdgeCurve, getEdgeCurveHandles, type EdgeCurveHandle } from "@entities/edge/edgeCurveGeometry";
import { updateEdges } from "@entities/edge/edgeMutations";
import type { Edge, EdgeRoutePreferences } from "@entities/edge/types";
import type { RootState } from "@store/store";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { useStatusActions } from "@ui/status/useStatusActions";

const DEFAULT = { flipped: false, curvature: 1 };
const same = (a: EdgeRoutePreferences, b: EdgeRoutePreferences) => a.flipped === b.flipped && Math.abs(a.curvature - b.curvature) < 1e-6;
function measure(data: string) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", data);
  return path;
}

/** Pointer capture isolates one reversible route edit from canvas selection and creation. */
export function useEdgeRouteEditing({ edge, enabled, getPath, baselineData, curvaturePolygons, curveSpace }: {
  edge: Edge; enabled: boolean; getPath: (preferences: EdgeRoutePreferences) => string | undefined;
  curvaturePolygons: LayoutPoint[][];
  baselineData: string; curveSpace: PathSpace;
}) {
  const { readOnly } = usePersistence();
  const commit = useStatusActions();
  const store = useStore<RootState>();
  const [draft, setDraft] = useState<{ preferences: EdgeRoutePreferences; data: string }>();
  const pendingMove = useRef<() => void>();
  const flushMove = useCallback(() => {
    const pending = pendingMove.current;
    pendingMove.current = undefined;
    pending?.();
  }, []);
  const clearMove = useCallback(() => {
    cancelFrame(flushMove);
    pendingMove.current = undefined;
  }, [flushMove]);
  const suppressClick = useRef(false);
  const gesture = useRef<{ pointerId: number; handle?: EdgeCurveHandle; baseline: string; space: PathSpace; maxima: { normal: number | undefined; flipped: number | undefined }; initial: EdgeRoutePreferences; latest: EdgeRoutePreferences; snapshot: RootState["encounter"]["present"] }>();
  const editable = enabled && !readOnly && edge.shape !== "straight";
  const maxima = useMemo(() => editable && edge.shape !== "rightAngled" ? { normal: getEdgeCurvatureMaximum(baselineData, false, curvaturePolygons), flipped: getEdgeCurvatureMaximum(baselineData, true, curvaturePolygons) } : { normal: undefined, flipped: undefined }, [editable, edge.shape, baselineData, curvaturePolygons]);
  const requested = draft?.preferences ?? edge.routePreferences ?? DEFAULT;
  const maximum = requested.flipped ? maxima.flipped : maxima.normal;
  const preferences = edge.shape === "rightAngled" || maximum === undefined ? requested : { ...requested, curvature: Math.min(requested.curvature, maximum) };
  const baselineHandles = useMemo(() => editable ? getEdgeCurveHandles(baselineData) : [], [editable, baselineData]);
  const handles = (editable && maximum !== undefined ? baselineHandles : []).map(handle => {
    const factor = (preferences.flipped ? -1 : 1) * preferences.curvature;
    return { ...handle, point: { x: handle.point.x + handle.normal.x * handle.offset * (factor - 1), y: handle.point.y + handle.normal.y * handle.offset * (factor - 1) } };
  });
  useEffect(() => {
    if (!editable) { clearMove(); gesture.current = undefined; setDraft(undefined); }
  }, [editable, clearMove]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && gesture.current) { event.stopPropagation(); clearMove(); gesture.current = undefined; setDraft(undefined); }
    };
    window.addEventListener("keydown", cancel);
    return () => { clearMove(); window.removeEventListener("keydown", cancel); };
  }, [clearMove]);

  function begin(event: ReactPointerEvent<SVGElement>, handle?: EdgeCurveHandle) {
    if (!editable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    suppressClick.current = Boolean(handle);
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, handle, baseline: baselineData, space: curveSpace, maxima, initial: preferences, latest: preferences, snapshot: store.getState().encounter.present };
  }
  function move(event: ReactPointerEvent<SVGElement>) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    suppressClick.current = true;
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    // Keep only the latest pointer position for Motion’s next frame.
    pendingMove.current = () => updateCurve(current, point);
    cancelFrame(flushMove);
    frame.update(flushMove);
  }
  function updateCurve(current: NonNullable<typeof gesture.current>, point: LayoutPoint) {
    if (gesture.current !== current || store.getState().encounter.present !== current.snapshot) return;
    let next: EdgeRoutePreferences;
    if (current.handle) {
      const { origin, normal, offset } = current.handle;
      const value = ((point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y) / offset;
      const flipped = value < 0;
      const limit = flipped ? current.maxima.flipped : current.maxima.normal;
      if (limit === undefined) return;
      next = { flipped, curvature: Math.min(Math.abs(value), limit) };
    } else {
      const opposite = { ...current.latest, flipped: !current.latest.flipped };
      const data = getPath(opposite), existing = getPath(current.latest);
      if (!data || !existing) return;
      const distance = (d: string) => {
        const path = measure(d), length = path.getTotalLength();
        let closest = Infinity;
        for (let at = 0; at <= length; at += Math.max(2, length / 150)) {
          const p = path.getPointAtLength(at);
          closest = Math.min(closest, Math.hypot(point.x - p.x, point.y - p.y));
        }
        return closest;
      };
      if (distance(data) + 4 >= distance(existing)) return;
      next = opposite;
    }
    const limit = next.flipped ? current.maxima.flipped : current.maxima.normal;
    if (edge.shape !== "rightAngled" && limit !== undefined) next.curvature = Math.min(next.curvature, limit);
    if (same(current.latest, next)) return;
    // Curvature changes control-point displacement on the frozen baseline.
    // Only body dragging needs the router to choose another path.
    const data = current.handle ? adjustEdgeCurve(current.baseline, next) : getPath(next);
    if (!data || (current.handle && !isEdgePathClear(data, current.space))) return;
    current.latest = next;
    setDraft({ preferences: next, data });
  }
  function end(event: ReactPointerEvent<SVGElement>, cancel = false) {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (!cancel) flushMove();
    clearMove();
    gesture.current = undefined;
    if (cancel || same(current.initial, current.latest)) { setDraft(undefined); return; }
    void commit("edge.adjustRoute", { edgeIds: [edge.id], routePreferences: current.latest }, state => {
      const target = state.edges.byId[edge.id];
      return !target || same(target.routePreferences ?? DEFAULT, current.latest) ? state : updateEdges(state, [edge.id], { routePreferences: current.latest });
    }, () => store.getState().encounter.present === current.snapshot).finally(() => setDraft(undefined));
  }
  // Browsers synthesize a click after pointerup; it must not become a canvas click.
  function click(event: { preventDefault: () => void; stopPropagation: () => void }) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }
  return { click, editable, handles, curvaturePercent: maximum && maximum > 0 ? Math.min(100, Math.round(preferences.curvature / maximum * 100)) : 0, pathData: editable ? draft?.data : undefined, dragging: Boolean(draft), begin, move, end };
}
