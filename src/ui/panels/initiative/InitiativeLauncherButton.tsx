import { ContactRound } from "lucide-react";

import { useInitiativePopout } from "./InitiativePopoutProvider";

export function InitiativeLauncherButton() {
  const { initiativeOpen, openInitiative } = useInitiativePopout();
  const label = initiativeOpen ? "Focus Initiative window" : "Open Initiative window";
  return <button aria-label={label} aria-pressed={initiativeOpen} className={`flex h-8 w-8 items-center justify-center rounded-full border ${initiativeOpen ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`} onClick={openInitiative} title={label} type="button"><ContactRound aria-hidden="true" className="h-4 w-4" /></button>;
}
