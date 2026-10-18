import { useEffect, useMemo, useRef, useState } from "react";
import { calculateEdgeFreePreview, type EdgeFreePreviewInput, type EdgeFreePreviewResponse } from "./edgeFreePreview";

type Job = { key: string; input: EdgeFreePreviewInput };
type Pending = Job & { requestId: number };

/** Coalesce pointer work and discard stale paths without blocking mouse input. */
export function useEdgeFreePreview(input: EdgeFreePreviewInput | null): string | undefined {
  const key = JSON.stringify(input);
  const state = useRef<{ worker?: Worker; queued?: Job; pending?: Pending; activeKey?: string; sequence: number }>({ sequence: 0 });
  const [result, setResult] = useState<{ key: string; data?: string }>();
  const fallback = useMemo(() => typeof Worker === "undefined" && input ? calculateEdgeFreePreview(input) : undefined, [key]);

  useEffect(() => {
    const current = state.current;
    current.activeKey = key;
    if (!input || typeof Worker === "undefined") {
      current.worker?.terminate();
      current.worker = undefined; current.queued = undefined; current.pending = undefined;
      return;
    }
    current.queued = { key, input };
    const pump = () => {
      if (!current.worker || current.pending || !current.queued) return;
      const job = current.queued;
      current.queued = undefined;
      current.pending = { ...job, requestId: ++current.sequence };
      current.worker.postMessage({ requestId: current.pending.requestId, input: job.input });
    };
    if (!current.worker) {
      try {
        const worker = new Worker(new URL("./edgeFreePreview.worker.ts", import.meta.url), { type: "module" });
        current.worker = worker;
        worker.addEventListener("message", (event: MessageEvent<EdgeFreePreviewResponse>) => {
          if (current.worker !== worker || current.pending?.requestId !== event.data.requestId) return;
          const completed = current.pending;
          current.pending = undefined;
          if (completed.key === current.activeKey) setResult({ key: completed.key, data: event.data.data });
          pump();
        });
        worker.addEventListener("error", () => {
          if (current.worker !== worker) return;
          worker.terminate(); current.worker = undefined; current.pending = undefined; current.queued = undefined;
        });
      } catch { current.queued = undefined; return; }
    }
    pump();
  }, [key]);

  useEffect(() => () => {
    state.current.worker?.terminate();
    state.current.worker = undefined; state.current.pending = undefined; state.current.queued = undefined;
  }, []);

  return typeof Worker === "undefined" ? fallback : result?.key === key ? result.data : undefined;
}
