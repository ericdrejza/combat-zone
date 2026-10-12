import { SettingsCategory, SettingsSection, SettingsField, SETTINGS_CONTROL, SETTINGS_BUTTON } from "./SettingsLayout";
import { Download, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";

import { useOptionalCloudSync } from "@ui/cloud_sync";
import {
  IMAGE_COMPRESSION_OPTIONS,
  readImageCompressionStrategyId,
  writeImageCompressionStrategyId
} from "@library/imageCompressionPreference";
import type { ImageCompressionStrategyId } from "@library/imageCompression";

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
  const [compressionStrategy, setCompressionStrategy] = useState(readImageCompressionStrategyId);
  const compressionDescription = IMAGE_COMPRESSION_OPTIONS.find(
    ({ value }) => value === compressionStrategy
  )?.description;

  function updateCompressionStrategy(strategy: ImageCompressionStrategyId) {
    setCompressionStrategy(strategy);
    writeImageCompressionStrategyId(strategy);
  }

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
    <SettingsCategory title="Data" description="Asset storage, workspace backups, and local data management.">
      <SettingsSection title="Asset storage">
        <SettingsField label="Image compression strategy" description={compressionDescription}>
          <select aria-label="Image compression strategy" className={SETTINGS_CONTROL} onChange={(event) => updateCompressionStrategy(event.currentTarget.value as ImageCompressionStrategyId)} value={compressionStrategy}>
            {IMAGE_COMPRESSION_OPTIONS.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </SettingsField>
      </SettingsSection>
      <SettingsSection title="Workspace backups" description="Export a workspace backup or import a workspace JSON file on this device.">
      <div className="flex flex-wrap gap-2">
        <button className={SETTINGS_BUTTON} onClick={onExportWorkspace} type="button"><Download aria-hidden="true" className="h-4 w-4" />Export workspace</button>
        <label className={`${SETTINGS_BUTTON} focus-within:ring-2 focus-within:ring-canvas-ink ${readOnly ? "cursor-not-allowed bg-canvas text-canvas-muted opacity-50" : "cursor-pointer hover:bg-canvas"}`}>
          <FileUp aria-hidden="true" className="h-4 w-4" />Import workspace
          <input accept="application/json,.json" aria-label="Import workspace JSON" className="sr-only" disabled={readOnly} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void onImportWorkspaceFile(file); }} type="file" />
        </label>
      </div>
      </SettingsSection>
      <SettingsSection title="Reset local data" danger>
        {!resetOpen ? (
          <button className="mt-3 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={readOnly} onClick={() => setResetOpen(true)} type="button"><Trash2 aria-hidden="true" className="h-4 w-4" />Reset local data</button>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-red-900 dark:text-red-500">This permanently removes local encounters, drafts, assets, backups, and preferences. Remote cloud data is not deleted.</p>
            <button className={`${SETTINGS_BUTTON} mt-3`} onClick={onExportWorkspace} type="button"><Download aria-hidden="true" className="h-4 w-4" />Export workspace first</button>
            <label className="mt-4 block text-sm font-medium text-red-950 dark:text-red-500">Type {RESET_CONFIRMATION} to continue<input aria-label="Local reset confirmation" autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-red-300 bg-canvas-surface px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-700 dark:border-red-800 dark:text-red-500 dark:focus-visible:ring-red-500" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} /></label>
            {error ? <p className="mt-2 text-sm text-red-800 dark:text-red-500" role="alert">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button className={SETTINGS_BUTTON} disabled={resetting} onClick={() => { setResetOpen(false); setConfirmation(""); }} type="button">Cancel</button>
              <button className="min-h-11 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition enabled:hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmation !== RESET_CONFIRMATION || resetting} onClick={() => void handleReset()} type="button">{resetting ? "Resetting…" : "Reset local data"}</button>
            </div>
          </div>
        )}
        {readOnly ? <p className="mt-2 text-xs text-red-800 dark:text-red-500">Close the editing tab before resetting local data here.</p> : null}
      </SettingsSection>
    </SettingsCategory>
  );
}
