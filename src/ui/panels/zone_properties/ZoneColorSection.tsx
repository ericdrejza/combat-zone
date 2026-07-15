import { ChevronDown, ChevronRight, Paintbrush } from "lucide-react";

import type { Zone } from "@entities/zone/types";
import type { ZonePaintBrushState } from "@interaction/interactionState";
import { ColorPalette } from "./ColorPalette";
import type { CommitZoneProperties } from "./types";

type ZoneColorSectionProps = {
  colorSectionOpen: boolean;
  onActivateZonePaintBrush: () => void;
  onCommitZoneProperties: CommitZoneProperties;
  onToggleColorSection: () => void;
  zone: Zone;
  zonePaintBrush: ZonePaintBrushState | null;
};

export function ZoneColorSection({
  colorSectionOpen,
  onActivateZonePaintBrush,
  onCommitZoneProperties,
  onToggleColorSection,
  zone,
  zonePaintBrush
}: ZoneColorSectionProps) {
  return (
    <section className="rounded-2xl border border-canvas-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          aria-expanded={colorSectionOpen}
          className="inline-flex items-center gap-2 font-semibold text-canvas-ink"
          onClick={onToggleColorSection}
          type="button"
        >
          {colorSectionOpen ? (
            <ChevronDown aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          )}
          Color
        </button>
        <button
          aria-pressed={zonePaintBrush?.sourceZoneId === zone.id}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
            zonePaintBrush?.sourceZoneId === zone.id
              ? "border-canvas-ink bg-canvas-ink text-white"
              : "border-canvas-line text-canvas-ink hover:bg-canvas"
          }`}
          onClick={onActivateZonePaintBrush}
          title="Paint zone colors"
          type="button"
        >
          <Paintbrush aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Paint zone colors</span>
        </button>
      </div>
      {colorSectionOpen ? (
        <div className="mt-4 space-y-4">
          <ColorPalette
            label="Fill color"
            onCommitZoneProperties={onCommitZoneProperties}
            property="colorFill"
            value={zone.colorFill}
          />
          <label className="block space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-canvas-ink">Opacity</span>
              <span className="font-mono text-[11px] text-canvas-muted">
                {Math.round(zone.opacity * 100)}%
              </span>
            </div>
            <input
              aria-label="Zone opacity"
              className="w-full accent-canvas-ink"
              max="1"
              min="0"
              onChange={(event) =>
                onCommitZoneProperties({
                  opacity: Number(event.currentTarget.value)
                })
              }
              step="0.05"
              type="range"
              value={zone.opacity}
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-canvas-line px-3 py-2">
            <span className="font-semibold text-canvas-ink">Show border</span>
            <input
              checked={zone.showBorder}
              className="h-5 w-5 accent-canvas-ink"
              onChange={(event) =>
                onCommitZoneProperties({
                  showBorder: event.currentTarget.checked
                })
              }
              type="checkbox"
            />
          </label>
          <ColorPalette
            label="Border color"
            onCommitZoneProperties={onCommitZoneProperties}
            property="colorBorder"
            value={zone.colorBorder}
          />
        </div>
      ) : null}
    </section>
  );
}
