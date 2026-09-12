import { useEffect, useId, useState } from "react";

import { DEFAULT_ZONE_PALETTE_COLOR } from "@entities/zone/zoneColors";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
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
    <label className="block space-y-1.5 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-8 w-8 shrink-0 rounded-full border border-canvas-line"
          style={{ backgroundColor: HEX_COLOR_PATTERN.test(draft) ? draft : "transparent" }}
        />
        <input
          aria-label={label}
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid}
          className="min-w-0 flex-1 rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 font-mono text-sm uppercase"
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
      {description ? <span className="block text-xs text-canvas-muted">{description}</span> : null}
      {invalid ? (
        <span className="block text-xs text-red-700 dark:text-red-300" id={errorId} role="alert">
          Enter a six-digit hex color beginning with #.
        </span>
      ) : null}
    </label>
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
    <section aria-labelledby="default-colors-heading" className="py-3">
      <h4 className="text-sm font-semibold" id="default-colors-heading">Colors</h4>
      <p className="mt-1 text-xs text-canvas-muted">
        Applied when creating a new zone.
      </p>
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
        <label className="block space-y-2 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Default zone opacity</span>
            <span className="font-mono text-[11px] text-canvas-muted">
              {Math.round(zoneOpacityDefault * 100)}%
            </span>
          </div>
          <input
            aria-label="Default zone opacity"
            className="w-full accent-canvas-ink"
            max="1"
            min="0"
            onChange={(event) =>
              setZoneOpacityDefault(Number(event.currentTarget.value))
            }
            step="0.05"
            type="range"
            value={zoneOpacityDefault}
          />
        </label>
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
          label="Show border"
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
    </section>
  );
}
