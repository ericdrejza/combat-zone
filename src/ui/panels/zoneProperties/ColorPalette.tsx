import type { CommitZoneProperties } from "./types";
import { zoneColorOptions } from "./options";

type ZoneColorProperty = "colorFill" | "colorBorder";

type ColorPaletteProps = {
  label: string;
  onCommitZoneProperties: CommitZoneProperties;
  property: ZoneColorProperty;
  value: string;
};

export function ColorPalette({
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
        aria-label={`${label} palette`}
        className="grid grid-cols-5 gap-2"
        role="group"
      >
        {zoneColorOptions.map((color) => (
          <button
            key={color}
            aria-label={`${label} ${color}`}
            aria-pressed={value === color}
            className={`h-8 rounded-full border transition ${
              value === color
                ? "border-canvas-ink ring-2 ring-canvas-ink/25"
                : "border-canvas-line"
            }`}
            onClick={() => onCommitZoneProperties({ [property]: color })}
            style={{ backgroundColor: color }}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
