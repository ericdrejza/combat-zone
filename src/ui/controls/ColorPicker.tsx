import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { SETTINGS_CONTROL } from "@ui/settings/SettingsLayout";
import { ColorPickerDropdown } from "./ColorPickerDropdown";
import { ColorDropperButton, ColorResetButton } from "./ColorPickerActions";

export type ColorPickerProps = {
  label: string;
  value: string | null;
  fallbackColor: string;
  onChange: (color: string | null, alpha?: number) => void;
  onCancel?: () => void;
  onCommit?: (color: string | null, alpha?: number) => void;
  onValidityChange?: (valid: boolean) => void;
  allowAlpha?: boolean;
  allowEmpty?: boolean;
  disabled?: boolean;
  resetValue?: string | null;
  labelAction?: ReactNode;
  inputLabel?: string;
  inputId?: string;
  describedBy?: string;
  closeOnSelect?: boolean;
};

/** Shared spectrum/hex editor. Live values and completed gestures have separate callbacks for history. */
export function ColorPicker({ label, value, fallbackColor, onChange, onCommit, onCancel, onValidityChange,
  allowAlpha = false, allowEmpty = false, disabled = false, resetValue, labelAction,
  inputLabel = `${label} hex color`, inputId, describedBy, closeOnSelect = false }: ColorPickerProps) {
  const { rememberCustomColor } = useInterfacePreferences();
  const [hex, setHex] = useState(value ?? (allowEmpty ? "" : fallbackColor));
  const [invalid, setInvalid] = useState(false);
  const dirty = useRef(false);
  const errorId = useId();
  const pattern = allowAlpha ? /^#[0-9a-f]{6}([0-9a-f]{2})?$/i : /^#[0-9a-f]{6}$/i;
  useEffect(() => {
    if (!dirty.current) { setHex(value ?? (allowEmpty ? "" : fallbackColor)); setInvalid(false); }
  }, [value, fallbackColor, allowEmpty]);
  function choose(color: string | null, alpha?: number) {
    dirty.current = false;
    setHex(color ?? (allowEmpty ? "" : fallbackColor)); setInvalid(false); onValidityChange?.(true);
    onChange(color, alpha);
  }
  function commitHex() {
    if (!dirty.current || disabled) return;
    const text = hex.trim();
    if (!text && allowEmpty) { choose(null); onCommit?.(null); return; }
    if (!pattern.test(text)) { setInvalid(true); onValidityChange?.(false); return; }
    const color = text.slice(0, 7).toLowerCase();
    const alpha = text.length === 9 ? parseInt(text.slice(7), 16) / 255 : undefined;
    // Preserve automatic/inherited colors when an unchanged effective hex value is blurred.
    const next = color === (value ?? fallbackColor).toLowerCase() ? value : color;
    choose(next, alpha); onCommit?.(next, alpha); rememberCustomColor(color);
  }
  return <div className="space-y-2" onKeyDownCapture={event => {
    if (event.key === "Escape") {
      dirty.current = false; setInvalid(false); setHex(value ?? (allowEmpty ? "" : fallbackColor));
      onValidityChange?.(true); onCancel?.();
    }
  }}>
    <ColorPickerDropdown label={label} value={value ?? fallbackColor} spectrum showLabel={false}
      disabled={disabled} labelAction={labelAction} closeOnSelect={closeOnSelect}
      onChange={color => choose(color)} onCommit={onCommit} onCancel={onCancel}
      controls={<>
        <div className="flex min-w-0 items-center gap-2">
          <input id={inputId} aria-label={inputLabel} aria-invalid={invalid}
            aria-describedby={[describedBy, invalid ? errorId : null].filter(Boolean).join(" ") || undefined}
            className={`${SETTINGS_CONTROL} font-mono uppercase`} disabled={disabled}
            type="text" spellCheck={false} placeholder={fallbackColor} value={hex}
            onChange={event => {
              dirty.current = true; setHex(event.currentTarget.value); setInvalid(false);
              onValidityChange?.((allowEmpty && !event.currentTarget.value.trim()) || pattern.test(event.currentTarget.value.trim()));
            }} onBlur={commitHex}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
          <ColorDropperButton label={label} disabled={disabled} onChange={color => {
            choose(color); onCommit?.(color); rememberCustomColor(color);
          }} />
          {resetValue !== undefined ? <ColorResetButton label={label} disabled={disabled} onReset={() => {
            choose(resetValue); onCommit?.(resetValue);
          }} /> : null}
        </div>
        {invalid ? <p id={errorId} role="alert" className="text-xs text-red-700 dark:text-red-500">
          {allowAlpha ? "Enter #RRGGBB or #RRGGBBAA." : "Enter a six-digit hex color beginning with #."}
        </p> : null}
      </>} />
  </div>;
}
