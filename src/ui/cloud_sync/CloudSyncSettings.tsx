import { Cloud, CloudOff, LogIn, LogOut, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useOptionalCloudSync } from "./CloudSyncContext";

const labels = {
  unavailable: "Unavailable",
  signedOut: "Signed out",
  authenticating: "Signing in…",
  entitlementRequired: "Cloud sync unavailable for this account",
  reconciling: "Waiting for reconciliation",
  syncing: "Syncing…",
  synced: "Synced",
  offline: "Offline — changes are queued",
  error: "Sync needs attention"
} as const;

export function CloudSyncSettings() {
  const cloud = useOptionalCloudSync();
  if (!cloud) return null;
  const used = cloud.usage ? cloud.usage.storedBytes + cloud.usage.reservedBytes : null;

  return (
    <section className="border-b border-canvas-line p-5" aria-labelledby="cloud-sync-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 id="cloud-sync-heading" className="font-display text-lg font-semibold">Cloud sync</h3>
          <p className="mt-1 text-sm text-canvas-muted">
            IndexedDB stays authoritative on this device; Firebase provides backup and multi-device sync.
          </p>
        </div>
        <motion.span
          aria-label={`Cloud sync status: ${labels[cloud.status]}`}
          className="flex shrink-0 items-center gap-2 rounded-full border border-canvas-line bg-canvas-surface px-3 py-1.5 text-xs"
          initial={false}
          animate={{ opacity: 1, scale: cloud.status === "syncing" ? 0.98 : 1 }}
        >
          {cloud.status === "offline" || cloud.status === "unavailable" ? <CloudOff className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
          {labels[cloud.status]}
        </motion.span>
      </div>
      {cloud.user ? (
        <div className="mt-4 rounded-2xl border border-canvas-line bg-canvas p-4 text-sm">
          <p className="font-medium">{cloud.user.displayName || cloud.user.email || "Google account"}</p>
          {cloud.user.email ? <p className="text-canvas-muted">{cloud.user.email}</p> : null}
          {used !== null && cloud.usage ? (
            <p className="mt-2 text-canvas-muted">
              Cloud uploads: {(used / 1_000_000).toFixed(1)} MB of {(cloud.usage.limitBytes / 1_000_000).toFixed(0)} MB
            </p>
          ) : null}
          <p className="mt-1 text-canvas-muted">
            Google Drive: {cloud.driveConnected ? "connected" : "connects when you link an image"}
          </p>
          <div className="mt-3 flex gap-2">
            {!cloud.driveConnected ? (
              <button className="flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 font-medium" onClick={() => void cloud.connectGoogleDrive().catch(() => undefined)} type="button">
                <Cloud className="h-4 w-4" /> Connect Drive
              </button>
            ) : null}
            <button className="flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 font-medium" onClick={() => void cloud.retry()} type="button">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
            <button className="flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 font-medium" onClick={() => void cloud.signOut()} type="button">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : (
        <button
          className="mt-4 flex items-center gap-2 rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-canvas-on-ink disabled:opacity-50"
          disabled={!cloud.backendAvailable || cloud.status === "authenticating"}
          onClick={() => void cloud.signIn()}
          type="button"
        >
          <LogIn className="h-4 w-4" /> Sign in with Google
        </button>
      )}
      {cloud.lastSuccessfulSyncAt ? <p className="mt-2 text-xs text-canvas-muted">Last synced {new Date(cloud.lastSuccessfulSyncAt).toLocaleString()}</p> : null}
      {cloud.error ? <p className="mt-2 text-sm text-red-700" role="alert">{cloud.error.message}</p> : null}
    </section>
  );
}
