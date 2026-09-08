import { Download, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";

import { useOptionalCloudSync } from "@ui/cloud_sync";

const RESET_CONFIRMATION = "RESET LOCAL DATA";

type DataSettingsProps = {
  onClose: () => void;
  onExportWorkspace: () => void;
  onResetLocalData: () => Promise<void> | void;
  onImportWorkspaceFile: (file: File) => Promise<void> | void;
  readOnly: boolean;
};

export function DataSettings({ onClose, onExportWorkspace, onResetLocalData, onImportWorkspaceFile, readOnly }: DataSettingsProps) {
  const cloud = useOptionalCloudSync();
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setResetting(true);
    setError(null);
    try {
      await cloud?.signOut();
      await onResetLocalData();
      onClose();
    } catch (reason) {
      setResetting(false);
      setError(reason instanceof Error ? reason.message : "Local reset failed.");
    }
  }

  return (
    <section className="p-5" aria-labelledby="settings-data-heading">
      <h3 id="settings-data-heading" className="font-display text-lg font-semibold">Data</h3>
      <p className="mt-1 text-sm text-canvas-muted">Export a backup or permanently remove this application's local data.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-4 py-2 text-sm font-medium transition hover:bg-canvas" onClick={onExportWorkspace} type="button"><Download aria-hidden="true" className="h-4 w-4" />Export workspace</button>
        <label className={`flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-4 py-2 text-sm font-medium transition ${readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-canvas"}`}>
          <FileUp aria-hidden="true" className="h-4 w-4" />Import workspace
          <input accept="application/json,.json" aria-label="Import workspace JSON" className="sr-only" disabled={readOnly} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onImportWorkspaceFile(file); }} type="file" />
        </label>
      </div>
      <div className="mt-4 rounded-2xl border border-red-300 bg-red-50 p-4">
        <h4 className="font-semibold text-red-900">Danger zone</h4>
        {!resetOpen ? (
          <button className="mt-3 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly} onClick={() => setResetOpen(true)} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" />Reset local data</button>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-red-900">This permanently removes local encounters, drafts, assets, backups, and preferences. Remote cloud data is not deleted.</p>
            <button className="mt-3 flex items-center gap-2 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm font-medium transition hover:bg-canvas" onClick={onExportWorkspace} type="button"><Download aria-hidden="true" className="h-4 w-4" />Export workspace first</button>
            <label className="mt-4 block text-sm font-medium text-red-950">Type {RESET_CONFIRMATION} to continue<input aria-label="Local reset confirmation" autoComplete="off" className="mt-1 w-full rounded-xl border border-red-300 bg-canvas-surface px-3 py-2 font-mono text-sm outline-none focus:border-red-700" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label>
            {error ? <p className="mt-2 text-sm text-red-800" role="alert">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded-xl border border-canvas-line bg-canvas-surface px-4 py-2 text-sm font-medium" disabled={resetting} onClick={() => { setResetOpen(false); setConfirmation(""); }} type="button">Cancel</button>
              <button className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmation !== RESET_CONFIRMATION || resetting} onClick={() => void handleReset()} type="button">{resetting ? "Resetting…" : "Reset local data"}</button>
            </div>
          </div>
        )}
        {readOnly ? <p className="mt-2 text-xs text-red-800">Close the editing tab before resetting local data here.</p> : null}
      </div>
    </section>
  );
}
