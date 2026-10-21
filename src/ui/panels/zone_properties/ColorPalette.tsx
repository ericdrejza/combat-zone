import { ColorPicker } from "@ui/controls/ColorPicker";
import type { CommitZoneProperties } from "./types";
import { useZoneColorControl } from "./useZoneColorControl";

type ZoneColorProperty = "colorFill" | "colorBorder" | "colorEngagement";
export function ColorPalette({ disabled, label, onCommitZoneProperties, property, value, zoneId }: {
  disabled?: boolean; label: string; onCommitZoneProperties: CommitZoneProperties;
  property: ZoneColorProperty; value: string; zoneId: string;
}) {
  const control = useZoneColorControl({ zoneId, property, value, disabled, onCommit: onCommitZoneProperties });
  return <ColorPicker disabled={disabled} label={label} value={control.draft} fallbackColor={value}
    onChange={control.preview} onCommit={control.commit} onCancel={control.cancel} />;
}
