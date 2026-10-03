import { BookHeadphones } from "lucide-react";

import { useSoundboard } from "./SoundboardProvider";
import type { SoundboardEntityTarget } from "./soundboardNavigation";

export function SoundboardLauncherButton({ target }: { target?: SoundboardEntityTarget }) {
  const { openSoundboard, soundboardOpen } = useSoundboard();
  return <button aria-label="Open Soundboard" aria-pressed={soundboardOpen} className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${soundboardOpen ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`} onClick={() => openSoundboard(target)} title={soundboardOpen ? "Soundboard open" : "Soundboard"} type="button"><BookHeadphones aria-hidden="true" className="h-4 w-4" /></button>;
}
