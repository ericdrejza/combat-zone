import { Settings } from "lucide-react";

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Open settings"
      className="flex h-10 w-10 items-center justify-center rounded-full border border-canvas-line bg-canvas-panel text-canvas-muted shadow-sm transition hover:bg-canvas-surface"
      onClick={onClick}
      title="Settings"
      type="button"
    >
      <Settings aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}
