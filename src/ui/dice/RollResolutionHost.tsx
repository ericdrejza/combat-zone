import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import { ResolutionDialog } from "./RollResolution";
import { registerResolutionHost } from "./resolutionRequests";
/** Status launches must resolve immediately even when the Log panel is hidden. */
export function RollResolutionHost() {
  const [id, setId] = useState<string | null>(null);
  const session = useSelector((s: RootState) => s.encounterLog.encounterSession);
  const message = useSelector((s: RootState) => id ? s.encounter.present.chatMessages.byId[id] : undefined);
  useEffect(() => registerResolutionHost(setId), []);
  useEffect(() => { setId(null); }, [session]);
  return message?.invocation?.phase === "pending" ? <ResolutionDialog key={message.id} message={message} onClose={() => setId(null)} /> : null;
}
