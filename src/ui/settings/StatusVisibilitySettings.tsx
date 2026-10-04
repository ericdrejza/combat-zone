import type { StatusVisibility } from "@ui/combat_preferences/statusVisibility";
import { CONDITIONS } from "@ui/status/markerCatalog";
import { StatusMarkerToggle } from "@ui/status/StatusMarkerToggle";
import { VisibilitySwitch } from "./VisibilitySwitch";

export function StatusVisibilitySettings({ value, onChange }: { value: StatusVisibility; onChange: (value: StatusVisibility) => void }) {
  return <fieldset className="space-y-3 border-t border-canvas-line pt-4">
    <legend className="pr-3 text-sm font-semibold">Status panel visibility</legend>
    <p className="text-sm text-canvas-muted">Choose which conditions to show. Hidden conditions still appear when active on a selected actor.</p>
    <VisibilitySwitch label="Conditions" ariaLabel="Show conditions" visible={value.showConditions} onChange={(showConditions) => onChange({ ...value, showConditions })} />
    <div aria-label="Visible conditions" role="group" className="flex flex-wrap gap-x-2 gap-y-1">
      {CONDITIONS.map(({ id, label, Icon }) => {
        const shown = !value.hiddenConditions.includes(id);
        return <StatusMarkerToggle key={id} label={`Show ${label}`} tooltip={`${shown ? "Hide" : "Show"} ${label}`} Icon={Icon} pressed={shown} onClick={() => onChange({
          ...value, hiddenConditions: shown ? [...value.hiddenConditions, id] : value.hiddenConditions.filter((hidden) => hidden !== id)
        })} />;
      })}
    </div>
    <VisibilitySwitch label="Weapons" ariaLabel="Show weapons" visible={value.showWeapons} onChange={(showWeapons) => onChange({ ...value, showWeapons })} />
    <VisibilitySwitch label="Armor" ariaLabel="Show armor" visible={value.showArmor} onChange={(showArmor) => onChange({ ...value, showArmor })} />
  </fieldset>;
}
