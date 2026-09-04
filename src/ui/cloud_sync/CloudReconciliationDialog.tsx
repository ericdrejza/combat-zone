import { useState } from "react";
import { useCloudSync } from "./CloudSyncContext";

const CONFIRMATION = "REPLACE CLOUD DATA";

export function CloudReconciliationDialog() {
  const cloud = useCloudSync();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!cloud.reconciliationRequired) return null;

  async function choose(choice: "merge" | "use_cloud" | "keep_device") {
    setBusy(true);
    setError(null);
    try {
      await cloud.reconcile(choice, confirmation);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reconciliation failed.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-6" role="dialog" aria-modal="true" aria-labelledby="cloud-reconciliation-title">
      <div className="w-[min(36rem,94vw)] rounded-3xl border border-canvas-line bg-canvas-panel p-6 shadow-2xl">
        <h2 id="cloud-reconciliation-title" className="font-display text-xl font-semibold">Choose your starting workspace</h2>
        <p className="mt-2 text-sm text-canvas-muted">This device and your cloud account both contain data. Merge is the safest default.</p>
        <div className="mt-5 grid gap-3">
          <button className="rounded-xl bg-canvas-ink px-4 py-3 text-left font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void choose("merge")} type="button">Merge both workspaces</button>
          <button className="rounded-xl border border-canvas-line bg-white px-4 py-3 text-left font-semibold disabled:opacity-50" disabled={busy} onClick={() => void choose("use_cloud")} type="button">Use cloud on this device</button>
          <div className="rounded-xl border border-red-300 bg-red-50 p-3">
            <label className="text-sm text-red-900">Type {CONFIRMATION} to keep this device and replace cloud data
              <input aria-label="Cloud replacement confirmation" className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-mono" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            <button className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || confirmation !== CONFIRMATION} onClick={() => void choose("keep_device")} type="button">Keep this device</button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
