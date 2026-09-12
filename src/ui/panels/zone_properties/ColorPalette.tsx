import type { CommitZoneProperties } from "./types";
import { ZONE_COLOR_PALETTE } from "@entities/zone/zoneColors";

type ZoneColorProperty = "colorFill" | "colorBorder" | "colorEngagement";

type ColorPaletteProps = {
  disabled?: boolean;
  label: string;
  onCommitZoneProperties: CommitZoneProperties;
  property: ZoneColorProperty;
  value: string;
};

export function ColorPalette({
  disabled = false,
  label,
  onCommitZoneProperties,
  property,
  value
}: ColorPaletteProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-canvas-ink">{label}</span>
        <span className="font-mono text-[11px] uppercase text-canvas-muted">
          {value}
        </span>
      </div>
      <div
        aria-disabled={disabled}
        aria-label={`${label} palette`}
        className={`grid grid-cols-5 gap-2 ${disabled ? "opacity-40" : ""}`}
        role="group"
      >
        {ZONE_COLOR_PALETTE.map((color) => (
          <button
            key={color}
            aria-label={`${label} ${color}`}
            aria-pressed={value === color}
            disabled={disabled}
            className={`h-8 rounded-full border transition ${
              value === color
                ? "border-canvas-ink ring-2 ring-canvas-ink/25"
                : "border-canvas-line"
            } ${disabled ? "cursor-not-allowed" : ""}`}
            onClick={() => onCommitZoneProperties({ [property]: color })}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
