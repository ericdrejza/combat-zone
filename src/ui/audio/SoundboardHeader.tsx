import { SquareArrowOutDownLeft, SquareArrowOutUpRight } from "lucide-react";

import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AudioTransportControls } from "./AudioTransportControls";
import { useAudioPlayback } from "./AudioPlaybackProvider";
import { SoundboardSelectionControls } from "./SoundboardSelectionControls";
import { SoundboardWarnings } from "./SoundboardWarnings";

export function SoundboardHeader({ isPopout, onToggleWindow, highlightSelection, filterSelection, onToggleHighlight, onToggleFilter }: {
  isPopout: boolean;
  onToggleWindow: () => void;
  highlightSelection: boolean;
  filterSelection: boolean;
  onToggleHighlight: () => void;
  onToggleFilter: () => void;
}) {
  const playback = useAudioPlayback();
  const preferences = useInterfacePreferences();
  return (
    <header className="sticky top-0 z-20 mb-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-3 rounded-2xl border border-canvas-line bg-canvas-panel p-3 shadow-sm md:flex-nowrap md:gap-4">
      <h1 className="order-1 shrink-0 md:order-none whitespace-nowrap font-display text-xl font-semibold">Soundboard</h1>
      <div className="contents md:flex md:min-w-0 md:flex-1 md:items-center md:justify-evenly md:gap-2">
        <div className="order-2 flex min-w-0 items-center gap-1 md:order-none">
          <span className="text-xs font-semibold uppercase text-canvas-muted">{playback.hasPausedPlayback ? playback.hasRunningPlayback ? "Partly paused" : "Paused" : playback.hasPlayback ? "Running" : "Idle"}</span>
          <SoundboardWarnings />
        </div>
        <div className="order-3 md:order-first">
          <SoundboardSelectionControls highlight={highlightSelection} filter={filterSelection} onToggleHighlight={onToggleHighlight} onToggleFilter={onToggleFilter} />
        </div>
        <div className="order-5 flex min-w-0 basis-full items-center justify-evenly gap-2 overflow-x-auto md:contents">
          <div className="shrink-0"><AudioTransportControls /></div>
          <label className="flex shrink-0 flex-col items-center gap-1 text-xs text-canvas-muted lg:flex-row lg:gap-2">
            <span className="inline-block w-[12ch] shrink-0 whitespace-nowrap tabular-nums">Master {Math.round(preferences.audioMasterVolume * 100)}%</span>
            <input aria-label="Soundboard master volume" className="w-24 shrink-0" max="100" min="0" onChange={(event) => preferences.setAudioMasterVolume(Number(event.currentTarget.value) / 100)} type="range" value={Math.round(preferences.audioMasterVolume * 100)} />
          </label>
        </div>
      </div>
      <button aria-label={isPopout ? "Dock Soundboard" : "Pop out Soundboard"} className="order-4 flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full border border-canvas-line hover:bg-canvas md:order-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink" onClick={onToggleWindow} title={isPopout ? "Dock Soundboard" : "Pop out Soundboard"} type="button">
        {isPopout ? <SquareArrowOutDownLeft aria-hidden="true" className="h-4 w-4" /> : <SquareArrowOutUpRight aria-hidden="true" className="h-4 w-4" />}
      </button>
    </header>
  );
}
