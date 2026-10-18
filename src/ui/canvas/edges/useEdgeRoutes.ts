import { useEffect, useMemo, useRef, useState } from "react";
import { calculateEdgeRoutes, type EdgeRouteInput, type EdgeRouteResult, type EdgeRouteResponse } from "./edgeRouteCalculation";

type Snapshot = { key: string; result: EdgeRouteResult; worker?: Worker };
type Job = { key: string; input: EdgeRouteInput; requestId?: number; sentAt?: number };

/** Stream prioritized routes and coalesce live changes between completed Edges. */
export function useEdgeRoutes(input: EdgeRouteInput, live: boolean) {
  const latest = useRef({ live, encounterId: input.encounterId });
  latest.current = { live, encounterId: input.encounterId };
  const { grid, canvasSize, movementRules } = input.state;
  const key = useMemo(() => {
    const geometry = (edge: EdgeRouteInput["edges"][number]) => [edge.id, edge.fromZoneId, edge.toZoneId, edge.shape, edge.directionality, edge.routePreferences];
    return JSON.stringify([input.encounterId, canvasSize,
      [grid.type, grid.cellSize, grid.origin, grid.rotation, grid.isometricAngle, grid.warp],
      movementRules.snapZoneVertices, input.polygons, input.edges.map(geometry), input.preview && geometry(input.preview), live, input.estimateOnly]);
  }, [input.encounterId, canvasSize, grid, movementRules.snapZoneVertices, input.polygons, input.edges, input.preview, live, input.estimateOnly]);
  const current = useRef<{ worker?: Worker; pending?: Job; queued?: Job; key?: string; sent?: EdgeRouteInput; sequence: number }>({ sequence: 0 });
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const fallback = useRef<Snapshot>();
  useMemo(() => {
    if (typeof Worker === "undefined" && !live && fallback.current?.key !== key) fallback.current = { key, result: calculateEdgeRoutes(input) };
  }, [key, live]);

  useEffect(() => {
    const state = current.current;
    state.key = key;
    if (typeof Worker === "undefined" || (!input.edges.length && !input.preview)) {
      state.worker?.terminate(); state.worker = undefined; state.pending = undefined; state.queued = undefined; state.sent = undefined;
      return;
    }
    if (snapshot?.key === key) return;
    state.queued = { key, input: { ...input, live } };
    const pump = () => {
      if (!state.worker || state.pending || !state.queued) return;
      state.pending = { ...state.queued, requestId: ++state.sequence, sentAt: performance.now() };
      state.queued = undefined;
      const next = state.pending.input;
      const reset = !state.sent || state.sent.encounterId !== next.encounterId;
      const before = reset ? {} : state.sent!.polygons;
      const polygons = Object.fromEntries(Object.entries(next.polygons).filter(([id, polygon]) => JSON.stringify(polygon) !== JSON.stringify(before[id])));
      const removedZoneIds = Object.keys(before).filter(id => !next.polygons[id]);
      state.worker.postMessage({ requestId: state.pending.requestId, input: { ...next, polygons }, reset, removedZoneIds });
      state.sent = next;
    };
    if (!state.worker) {
      try {
        const worker = new Worker(new URL("./edgeRoutes.worker.ts", import.meta.url), { type: "module" });
        state.worker = worker;
        // Deltas are relative to this worker's memory, never a terminated worker.
        state.sent = undefined;
        worker.addEventListener("message", (event: MessageEvent<EdgeRouteResponse>) => {
          if (state.worker !== worker || state.pending?.requestId !== event.data.requestId) return;
          const completed = state.pending;
          const { result, done = true, metrics } = event.data;
          if (metrics) globalThis.dispatchEvent(new CustomEvent("combat-zone:edge-route-metrics", { detail: {
            ...metrics, requestId: completed.requestId, encounterId: result.encounterId,
            elapsed: performance.now() - completed.sentAt!
          } }));
          if (result.encounterId === latest.current.encounterId && (completed.key === state.key || latest.current.live)) setSnapshot(previous => {
            const ids = new Set([...completed.input.edges.map(edge => edge.id), ...(completed.input.preview ? [completed.input.preview.id] : [])]);
            // Route revisions restart with each worker, so compare only within
            // the same instance when suppressing unchanged streamed results.
            const before = previous?.worker === worker && previous.result.encounterId === result.encounterId ? previous.result.byId : {};
            const changed = Object.entries(result.byId).filter(([id, route]) => route.revision === undefined || before[id]?.revision !== route.revision);
            if (!done && !changed.length) return previous;
            const byId = Object.fromEntries(Object.entries({ ...before, ...Object.fromEntries(changed) }).filter(([id]) => ids.has(id)));
            return { key: done ? completed.key : "", result: { encounterId: result.encounterId, byId }, worker };
          });
          if (done || state.queued) { state.pending = undefined; pump(); }
        });
        worker.addEventListener("error", () => {
          if (state.worker !== worker) return;
          worker.terminate(); state.worker = undefined; state.pending = undefined; state.queued = undefined; state.sent = undefined;
        });
      } catch { state.queued = undefined; return; }
    }
    pump();
  }, [key, live]);

  useEffect(() => () => {
    current.current.worker?.terminate(); current.current.worker = undefined;
    current.current.pending = undefined; current.current.queued = undefined;
    current.current.sent = undefined;
  }, []);

  const completed = typeof Worker === "undefined" ? fallback.current : snapshot;
  return {
    routes: completed?.result.encounterId === input.encounterId ? completed.result.byId : {},
    pending: live || completed?.key !== key
  };
}
