import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { MAX_SELECTION_OUTLINE_WIDTH, MIN_SELECTION_OUTLINE_WIDTH } from "@ui/interface_preferences/selectionOutlinePreferences";
import { SettingsField, SettingsSection, SETTINGS_SLIDER } from "./SettingsLayout";

export function BorderThicknessSettings() {
  const {
    zoneBorderThickness, setZoneBorderThickness,
    actorBorderThickness, setActorBorderThickness,
    edgeThickness, setEdgeThickness
  } = useInterfacePreferences();
  const fields = [
    { label: "Zone border thickness", value: zoneBorderThickness, setValue: setZoneBorderThickness },
    { label: "Actor border thickness", value: actorBorderThickness, setValue: setActorBorderThickness },
    { label: "Edge thickness", value: edgeThickness, setValue: setEdgeThickness }
  ];
  return (
    <SettingsSection title="Border thickness" description="Normal border and Edge thickness in whole canvas units from 1 to 8.">
      {fields.map(({ label, value, setValue }) => (
        <SettingsField key={label} label={label} valueLabel={value}>
          <input className={SETTINGS_SLIDER} type="range" min={MIN_SELECTION_OUTLINE_WIDTH}
            max={MAX_SELECTION_OUTLINE_WIDTH} step="1" value={value}
            onChange={event => setValue(event.currentTarget.valueAsNumber)} />
        </SettingsField>
      ))}
    </SettingsSection>
  );
}
