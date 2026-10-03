import type { AudioCueType } from "@entities/audio/types";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AUDIO_REPEAT_DELAYS, formatAudioRepeatDelay } from "@ui/audio/audioRepeatDelay";

const CUE_TYPES: Array<{ label: string; value: AudioCueType }> = [
  { label: "Loop", value: "loop" },
  { label: "Effect", value: "one_shot" }
];

export function AudioSettings() {
  const preferences = useInterfacePreferences();
  const repeatDelay = preferences.audioRepeatDelayDefaults;

  function updateDelay(key: "minimumDelaySeconds" | "maximumDelaySeconds", value: number) {
    const next = { ...repeatDelay, [key]: Math.max(0, value || 0) };
    if (next.maximumDelaySeconds < next.minimumDelaySeconds) {
      next.maximumDelaySeconds = next.minimumDelaySeconds;
    }
    preferences.setAudioRepeatDelayDefaults(next);
  }

  return (
    <section className="space-y-6 p-5" aria-labelledby="settings-audio-heading">
      <div>
        <h3 className="font-display text-lg font-semibold" id="settings-audio-heading">Audio</h3>
        <p className="mt-1 text-sm text-canvas-muted">Device output and defaults for newly assigned cues.</p>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        <span>Master volume: {Math.round(preferences.audioMasterVolume * 100)}%</span>
        <input aria-label="Master volume" className="w-full" max="100" min="0" onChange={(event) => preferences.setAudioMasterVolume(Number(event.target.value) / 100)} type="range" value={Math.round(preferences.audioMasterVolume * 100)} />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>Default cue volume: {Math.round(preferences.audioCueVolumeDefault * 100)}%</span>
        <input aria-label="Default cue volume" className="w-full" max="100" min="0" step="10" onChange={(event) => preferences.setAudioCueVolumeDefault(Number(event.target.value) / 100)} type="range" value={Math.round(preferences.audioCueVolumeDefault * 100)} />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        <span>Keyboard Play/Pause controls</span>
        <select aria-label="Keyboard Play/Pause controls" className="block rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2" onChange={(event) => preferences.setAudioMediaKeyScope(event.target.value as "all" | "music")} value={preferences.audioMediaKeyScope}>
          <option value="all">All sounds</option>
          <option value="music">Music only</option>
        </select>
      </label>
      <fieldset className="space-y-3 border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Default cue types</legend>
        {(["encounter", "music", "zone", "actor"] as const).map((owner) => (
          <label className="flex items-center justify-between gap-4 text-sm capitalize" key={owner}>
            {owner === "encounter" ? "Encounter Ambience" : owner === "music" ? "Music groups" : `${owner} groups`}
            <select aria-label={`${owner} default cue type`} className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2" disabled={owner !== "encounter"} onChange={(event) => owner === "encounter" && preferences.setAudioCueTypeDefault(owner, event.target.value as AudioCueType)} value={owner === "music" ? "loop" : owner === "zone" || owner === "actor" ? "one_shot" : preferences.audioCueTypeDefaults[owner]}>
              {CUE_TYPES.filter((type) => owner === "music" ? type.value === "loop" : owner === "zone" || owner === "actor" ? type.value === "one_shot" : true).map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-3 border-t border-canvas-line pt-5">
        <legend className="pr-3 text-sm font-semibold">Default Effect repeat delay</legend>
        <p className="text-sm">By default, repeated effects will repeat their sound every <Delay label="Default Effect repeat delay from" value={repeatDelay.minimumDelaySeconds} onChange={(value) => updateDelay("minimumDelaySeconds", value)} /> to <Delay label="Default Effect repeat delay to" value={repeatDelay.maximumDelaySeconds} onChange={(value) => updateDelay("maximumDelaySeconds", value)} /></p>
      </fieldset>
    </section>
  );
}

function Delay({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <select aria-label={label} className="rounded border border-canvas-line bg-canvas-surface px-1 py-0.5" onChange={(event) => onChange(Number(event.target.value))} value={value}>{AUDIO_REPEAT_DELAYS.map((seconds) => <option key={seconds} value={seconds}>{formatAudioRepeatDelay(seconds)}</option>)}</select>;
}
