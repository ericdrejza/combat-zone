import { calculateEdgeFreePreview, type EdgeFreePreviewRequest, type EdgeFreePreviewResponse } from "./edgeFreePreview";

self.addEventListener("message", (event: MessageEvent<EdgeFreePreviewRequest>) => {
  const { requestId, input } = event.data;
  let data: string | undefined;
  try { data = calculateEdgeFreePreview(input); } catch { /* An unavailable preview must not interrupt the drag. */ }
  self.postMessage({ requestId, data } satisfies EdgeFreePreviewResponse);
});
