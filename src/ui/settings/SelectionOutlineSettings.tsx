import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import {
  MAX_SELECTION_OUTLINE_WIDTH, MIN_SELECTION_OUTLINE_WIDTH, readSelectionOutlineMode
} from "@ui/interface_preferences/selectionOutlinePreferences";
import { SettingsField, SettingsSection, SETTINGS_CONTROL, SETTINGS_SLIDER } from "./SettingsLayout";

export function SelectionOutlineSettings() {
  const {
    actorSelectionOutline, setActorSelectionOutline,
    zoneSelectionOutline, setZoneSelectionOutline,
    actorSelectionOutlineWidth, setActorSelectionOutlineWidth,
    zoneSelectionOutlineWidth, setZoneSelectionOutlineWidth
  } = useInterfacePreferences();
  const fields = [
    { entity: "Actor", mode: actorSelectionOutline, setMode: setActorSelectionOutline,
      width: actorSelectionOutlineWidth, setWidth: setActorSelectionOutlineWidth },
    { entity: "Zone", mode: zoneSelectionOutline, setMode: setZoneSelectionOutline,
      width: zoneSelectionOutlineWidth, setWidth: setZoneSelectionOutlineWidth }
  ];

  return (
    <SettingsSection title="Selection outlines" description="Pulse limited draws attention with two pulses, then stays visible. Pulsing follows animation and reduced-motion preferences. Thickness uses canvas units from 1 to 8.">
      {fields.map(({ entity, mode, setMode, width, setWidth }) => (
        <div key={entity}>
          <SettingsField label={`Selected ${entity} outline`}>
            <select className={SETTINGS_CONTROL} value={mode}
              onChange={event => setMode(readSelectionOutlineMode(event.currentTarget.value))}>
              <option value="static">Static</option>
              <option value="pulse">Pulse</option>
              <option value="pulse_limited">Pulse limited</option>
            </select>
          </SettingsField>
          <SettingsField label={`${entity} outline thickness`} valueLabel={width}>
            <input className={`${SETTINGS_SLIDER} w-full`} type="range" min={MIN_SELECTION_OUTLINE_WIDTH} max={MAX_SELECTION_OUTLINE_WIDTH} step="1"
              value={width} onChange={event => setWidth(event.currentTarget.valueAsNumber)} />
          </SettingsField>
        </div>
      ))}
    </SettingsSection>
  );
}
