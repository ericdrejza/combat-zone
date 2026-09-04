import { Cloud, CloudOff, LoaderCircle, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useOptionalCloudSync } from "./CloudSyncContext";

export function CloudStatusIndicator() {
  const cloud = useOptionalCloudSync();
  if (!cloud || cloud.status === "unavailable" || cloud.status === "signedOut") return null;
  const label = cloud.status === "synced" ? "Cloud synced" :
    cloud.status === "syncing" ? "Cloud syncing" :
    cloud.status === "offline" ? "Cloud offline; changes queued" :
    cloud.status === "error" ? "Cloud sync error" :
    cloud.status === "reconciling" ? "Cloud reconciliation required" : "Cloud authentication in progress";
  const Icon = cloud.status === "syncing" || cloud.status === "authenticating" ? LoaderCircle :
    cloud.status === "offline" ? CloudOff : cloud.status === "error" ? TriangleAlert : Cloud;
  return (
    <motion.span
      aria-label={label}
      className={`flex h-8 items-center gap-1 rounded-lg px-2 text-xs ${cloud.status === "error" ? "text-red-700" : "text-canvas-muted"}`}
      initial={false}
      animate={{ opacity: 1 }}
      title={label}
    >
      <Icon aria-hidden="true" className={`h-4 w-4 ${cloud.status === "syncing" ? "animate-spin" : ""}`} />
      <span className="sr-only">{label}</span>
    </motion.span>
  );
}
