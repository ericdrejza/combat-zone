import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { AUDIO_REPEAT_DELAYS, formatAudioRepeatDelay } from "@ui/audio/audioRepeatDelay";
import type { AmbienceCueTypeDefault } from "@ui/interface_preferences/audioPreferences";
import { PreferenceSwitch } from "./PreferenceSwitch";
import { SettingsCategory, SettingsSection, SettingsSubsection, SettingsField, SettingsRow, SETTINGS_CONTROL, SETTINGS_SLIDER } from "./SettingsLayout";

export function AudioSettings() {
  const preferences = useInterfacePreferences();
  const repeatDelay = preferences.audioRepeatDelayDefaults;
  function updateDelay(key: "minimumDelaySeconds" | "maximumDelaySeconds", value: number) {
    const next = { ...repeatDelay, [key]: Math.max(0, value || 0) };
    if (next.maximumDelaySeconds < next.minimumDelaySeconds) next.maximumDelaySeconds = next.minimumDelaySeconds;
    preferences.setAudioRepeatDelayDefaults(next);
  }
  return <SettingsCategory title="Audio" description="Playback on this device and defaults for newly assigned cues.">
    <SettingsSection title="Playback">
      <SettingsField label="Master volume" fullWidth valueLabel={`${Math.round(preferences.audioMasterVolume * 100)}%`}>
        <input aria-label="Master volume" className={SETTINGS_SLIDER} max="100" min="0" onChange={(event) => preferences.setAudioMasterVolume(Number(event.target.value) / 100)} type="range" value={Math.round(preferences.audioMasterVolume * 100)} />
      </SettingsField>
      <SettingsField label="Keyboard Play/Pause controls">
        <select aria-label="Keyboard Play/Pause controls" className={SETTINGS_CONTROL} onChange={(event) => preferences.setAudioMediaKeyScope(event.target.value as "all" | "music")} value={preferences.audioMediaKeyScope}>
          <option value="all">All sounds</option><option value="music">Music only</option>
        </select>
      </SettingsField>
    </SettingsSection>
    <SettingsSection title="Cue defaults" description="Applied when assigning new cues.">
      <SettingsField label="Default cue volume" fullWidth valueLabel={`${Math.round(preferences.audioCueVolumeDefault * 100)}%`}>
        <input aria-label="Default cue volume" className={SETTINGS_SLIDER} max="100" min="0" step="10" onChange={(event) => preferences.setAudioCueVolumeDefault(Number(event.target.value) / 100)} type="range" value={Math.round(preferences.audioCueVolumeDefault * 100)} />
      </SettingsField>
      <SettingsSubsection title="Ambience classification">
        <SettingsField label="Default Ambience cue type" description={preferences.audioAmbienceCueTypeDefault === "asset_icon" ? "Music assets default to Track; Audio assets default to Effect, using their Library icon." : undefined}>
          <select aria-label="Default Ambience cue type" className={SETTINGS_CONTROL} value={preferences.audioAmbienceCueTypeDefault} onChange={(event) => preferences.setAudioAmbienceCueTypeDefault(event.target.value as AmbienceCueTypeDefault)}>
            <option value="asset_icon">Asset Icon</option><option value="duration_threshold">Duration threshold</option><option value="effect">Effect</option><option value="track">Track</option>
          </select>
        </SettingsField>
        <SettingsField label="Duration threshold (seconds)" description="Used by the Timer tool choice and duration-based Ambience defaults. Longer sounds default to Track; others default to Effect. If duration is unavailable, the Library icon determines the type.">
          <input aria-label="Audio duration threshold (seconds)" className={SETTINGS_CONTROL} min="0" step="any" type="number" value={preferences.audioAmbienceDurationThreshold} onChange={(event) => { if (event.currentTarget.value !== "" && event.currentTarget.validity.valid) preferences.setAudioAmbienceDurationThreshold(event.currentTarget.valueAsNumber); }} />
        </SettingsField>
      </SettingsSubsection>
      <SettingsSubsection title="Repetition">
        <PreferenceSwitch label="Repeat music cues by default" checked={preferences.audioMusicCueRepeatDefault} onChange={preferences.setAudioMusicCueRepeatDefault} />
        <PreferenceSwitch label="Loop new Music groups by default" checked={preferences.audioMusicGroupLoopDefault} onChange={preferences.setAudioMusicGroupLoopDefault} />
        <SettingsRow label="Default Effect repeat delay" description="Repeated effects use a delay within this range." fullWidth>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <SettingsField label="From" fullWidth><Delay label="Default Effect repeat delay from" value={repeatDelay.minimumDelaySeconds} onChange={(value) => updateDelay("minimumDelaySeconds", value)} /></SettingsField>
            <SettingsField label="To" fullWidth><Delay label="Default Effect repeat delay to" value={repeatDelay.maximumDelaySeconds} onChange={(value) => updateDelay("maximumDelaySeconds", value)} /></SettingsField>
          </div>
        </SettingsRow>
      </SettingsSubsection>
    </SettingsSection>
  </SettingsCategory>;
}

function Delay({ label, onChange, value, id, "aria-describedby": describedBy }: { label: string; onChange: (value: number) => void; value: number; id?: string; "aria-describedby"?: string }) {
  return <select id={id} aria-describedby={describedBy} aria-label={label} className={SETTINGS_CONTROL} onChange={(event) => onChange(Number(event.target.value))} value={value}>{AUDIO_REPEAT_DELAYS.map((seconds) => <option key={seconds} value={seconds}>{formatAudioRepeatDelay(seconds)}</option>)}</select>;
}
