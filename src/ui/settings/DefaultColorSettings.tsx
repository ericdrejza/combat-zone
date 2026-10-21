import { HexColorInput } from "./HexColorInput";

import { DEFAULT_ZONE_PALETTE_COLOR } from "@entities/zone/zoneColors";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { SettingsField, SettingsSubsection, SETTINGS_SLIDER } from "./SettingsLayout";
import { PreferenceSwitch } from "./PreferenceSwitch";

/** Edits the colors copied into newly created Zones. */
export function DefaultColorSettings() {
  const {
    setZoneColorDefaults,
    setZoneOpacityDefault,
    setZoneShowBorderDefault,
    zoneColorDefaults,
    zoneOpacityDefault,
    zoneShowBorderDefault
  } = useInterfacePreferences();

  return (
    <SettingsSubsection title="Zone appearance" description="Applied when creating a new Zone." region>
      <div className="mt-2 divide-y divide-canvas-line">
        <HexColorInput
          description="Leave blank to use the first palette color."
          label="Default zone color"
          onCommit={(zone) =>
            setZoneColorDefaults({ ...zoneColorDefaults, zone })
          }
          placeholder={DEFAULT_ZONE_PALETTE_COLOR}
          value={zoneColorDefaults.zone}
        />
        <SettingsField label="Default zone opacity" fullWidth valueLabel={`${Math.round(zoneOpacityDefault * 100)}%`}>
          <input
            aria-label="Default zone opacity"
            className={SETTINGS_SLIDER}
            max="1"
            min="0"
            onChange={(event) =>
              setZoneOpacityDefault(Number(event.currentTarget.value))
            }
            step="0.05"
            type="range"
            value={zoneOpacityDefault}
          />
        </SettingsField>
        <HexColorInput
          description="Leave blank to use the first palette color."
          label="Default border color"
          onCommit={(border) =>
            setZoneColorDefaults({ ...zoneColorDefaults, border })
          }
          placeholder={DEFAULT_ZONE_PALETTE_COLOR}
          value={zoneColorDefaults.border}
        />
        <PreferenceSwitch
          checked={zoneShowBorderDefault}
          label="Show border by default"
          onChange={setZoneShowBorderDefault}
        />
        <HexColorInput
          description="Leave blank to match the border color on new zones."
          label="Default engagements color"
          onCommit={(engagement) =>
            setZoneColorDefaults({ ...zoneColorDefaults, engagement })
          }
          placeholder={
            zoneColorDefaults.border ?? DEFAULT_ZONE_PALETTE_COLOR
          }
          value={zoneColorDefaults.engagement}
        />
      </div>
    </SettingsSubsection>
  );
}
