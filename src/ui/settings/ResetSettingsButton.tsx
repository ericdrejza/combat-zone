import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { ConfirmStatusDialog } from "@ui/panels/status_panel/StatusDialog";
import { SETTINGS_BUTTON } from "./SettingsLayout";

/** Category resets require confirmation and restore focus on dismissal. */
export function ResetSettingsButton({ category, onReset }: { category: string; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return <>
    <button className={SETTINGS_BUTTON} type="button" aria-label={`Reset ${category} to defaults`} onClick={() => setConfirming(true)}>
      <RotateCcw aria-hidden="true" className="h-4 w-4" />Reset to defaults
    </button>
    {confirming ? <ConfirmStatusDialog title={`Reset ${category} settings?`} confirmLabel="Reset to defaults"
      onClose={() => setConfirming(false)} onConfirm={() => { onReset(); setConfirming(false); }}>
      <p className="text-sm">Restore the default preferences for {category}? Other settings categories and saved encounter data will be preserved.</p>
    </ConfirmStatusDialog> : null}
  </>;
}
