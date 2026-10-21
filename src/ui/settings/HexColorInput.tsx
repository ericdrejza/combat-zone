import { useId } from "react";
import { ColorPicker } from "@ui/controls/ColorPicker";
import { SettingsRow } from "./SettingsLayout";

/** Settings retain their nullable defaults while sharing the application color editor. */
export function HexColorInput({ description, label, onCommit, placeholder, value }: {
  description?: string;
  label: string;
  onCommit: (value: string | null) => void;
  placeholder: string;
  value: string | null;
}) {
  const inputId = useId(), helpId = useId();
  return <SettingsRow label={label} controlId={inputId} descriptionId={helpId}
    description={`${description ?? ""} Picker changes save immediately. Hex values save when you leave the field or press Enter.`}>
    <ColorPicker label={label} value={value} fallbackColor={placeholder} allowEmpty resetValue={null}
      inputLabel={label} inputId={inputId} describedBy={helpId} onChange={onCommit} />
  </SettingsRow>;
}
