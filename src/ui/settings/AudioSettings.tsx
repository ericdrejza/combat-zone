import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AUDIO_REPEAT_DELAYS, formatAudioRepeatDelay } from "@ui/audio/audioRepeatDelay";

import type { AmbienceCueTypeDefault } from "@ui/interface_preferences/audioPreferences";

import { PreferenceSwitch } from "./PreferenceSwitch";

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
        <span>Keyboard Play/Pause controls</span>
        <select aria-label="Keyboard Play/Pause controls" className="block rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2" onChange={(event) => preferences.setAudioMediaKeyScope(event.target.value as "all" | "music")} value={preferences.audioMediaKeyScope}>
          <option value="all">All sounds</option>
          <option value="music">Music only</option>
        </select>
      </label>
      <section aria-labelledby="settings-audio-defaults-heading" className="space-y-4 border-t border-canvas-line pt-5">
        <h4 id="settings-audio-defaults-heading" className="font-display font-semibold">Defaults</h4>
        <label className="block space-y-2 text-sm font-medium">
          <span>Default cue volume: {Math.round(preferences.audioCueVolumeDefault * 100)}%</span>
          <input aria-label="Default cue volume" className="w-full" max="100" min="0" step="10" onChange={(event) => preferences.setAudioCueVolumeDefault(Number(event.target.value) / 100)} type="range" value={Math.round(preferences.audioCueVolumeDefault * 100)} />
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Default Ambience cue type</span>
          <select aria-label="Default Ambience cue type" className="block w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 hover:border-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink" value={preferences.audioAmbienceCueTypeDefault} onChange={(event) => preferences.setAudioAmbienceCueTypeDefault(event.target.value as AmbienceCueTypeDefault)}>
            <option value="asset_icon">Asset Icon</option>
            <option value="duration_threshold">Duration threshold</option>
            <option value="effect">Effect</option>
            <option value="track">Track</option>
          </select>
          {preferences.audioAmbienceCueTypeDefault === "asset_icon" ? <span className="block text-xs font-normal text-canvas-muted">Music assets default to Track; Audio assets default to Effect, using their Library icon.</span> : null}
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>Duration threshold (seconds)</span>
          <input aria-label="Audio duration threshold (seconds)" className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 hover:border-canvas-muted focus-visible:ring-2 focus-visible:ring-canvas-ink" min="0" step="any" type="number" value={preferences.audioAmbienceDurationThreshold} onChange={(event) => { if (event.currentTarget.value !== "" && event.currentTarget.validity.valid) preferences.setAudioAmbienceDurationThreshold(event.currentTarget.valueAsNumber); }} />
          <span className="block text-xs text-canvas-muted">Used by the Timer tool choice and duration-based Ambience defaults. Longer sounds default to Track; others default to Effect. If duration is unavailable, the Library icon determines the type.</span>
        </label>
        <PreferenceSwitch label="Repeat music cues by default" checked={preferences.audioMusicCueRepeatDefault} onChange={preferences.setAudioMusicCueRepeatDefault} />
        <PreferenceSwitch label="Loop new Music groups by default" checked={preferences.audioMusicGroupLoopDefault} onChange={preferences.setAudioMusicGroupLoopDefault} />
        <fieldset className="space-y-3 border-t border-canvas-line pt-5">
          <legend className="pr-3 text-sm font-semibold">Default Effect repeat delay</legend>
          <p className="text-sm">By default, repeated effects will repeat their sound every <Delay label="Default Effect repeat delay from" value={repeatDelay.minimumDelaySeconds} onChange={(value) => updateDelay("minimumDelaySeconds", value)} /> to <Delay label="Default Effect repeat delay to" value={repeatDelay.maximumDelaySeconds} onChange={(value) => updateDelay("maximumDelaySeconds", value)} /></p>
        </fieldset>
      </section>
    </section>
  );
}

function Delay({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return <select aria-label={label} className="rounded border border-canvas-line bg-canvas-surface px-1 py-0.5" onChange={(event) => onChange(Number(event.target.value))} value={value}>{AUDIO_REPEAT_DELAYS.map((seconds) => <option key={seconds} value={seconds}>{formatAudioRepeatDelay(seconds)}</option>)}</select>;
}
