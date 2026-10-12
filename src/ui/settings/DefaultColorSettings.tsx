import { useEffect, useId, useState } from "react";

import { DEFAULT_ZONE_PALETTE_COLOR } from "@entities/zone/zoneColors";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { SettingsRow, SettingsField, SettingsSubsection, SETTINGS_CONTROL, SETTINGS_SLIDER } from "./SettingsLayout";
import { PreferenceSwitch } from "./PreferenceSwitch";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function HexColorInput({
  description,
  label,
  onCommit,
  placeholder,
  value
}: {
  description?: string;
  label: string;
  onCommit: (value: string | null) => void;
  placeholder: string;
  value: string | null;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const inputId = useId();
  const helpId = useId();

  useEffect(() => {
    setDraft(value ?? "");
    setInvalid(false);
  }, [value]);

  function commit() {
    const next = draft.trim();
    if (next === "") {
      setInvalid(false);
      onCommit(null);
      return;
    }
    if (!HEX_COLOR_PATTERN.test(next)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    const normalized = next.toLowerCase();
    setDraft(normalized);
    onCommit(normalized);
  }

  return (
    <SettingsRow label={label} controlId={inputId} descriptionId={helpId} description={`${description ?? ""} Saves when you leave the field or press Enter.`}>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 rounded-full border border-canvas-line"
          style={{ backgroundColor: HEX_COLOR_PATTERN.test(draft) ? draft : "transparent" }}
        />
        <input
          aria-label={label}
          id={inputId}
          aria-describedby={[helpId, invalid ? errorId : null].filter(Boolean).join(" ")}
          aria-invalid={invalid}
          className={`${SETTINGS_CONTROL} font-mono uppercase`}
          onBlur={commit}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          placeholder={placeholder}
          spellCheck={false}
          type="text"
          value={draft}
        />
      </div>
      {invalid ? (
        <span className="block text-xs text-red-700 dark:text-red-500" id={errorId} role="alert">
          Enter a six-digit hex color beginning with #.
        </span>
      ) : null}
    </SettingsRow>
  );
}

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
