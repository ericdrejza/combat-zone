import { useEffect, useId, useState } from "react";
import { SettingsRow, SETTINGS_CONTROL } from "./SettingsLayout";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function HexColorInput({
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

