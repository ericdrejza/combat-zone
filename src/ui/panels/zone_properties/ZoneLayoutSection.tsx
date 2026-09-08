import type { LayoutOrientation } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import { Eye, EyeOff, Zap, ZapOff } from "lucide-react";
import {
  isSplitLayoutStrategy,
  zoneLayoutOrientations,
  zoneLayoutStrategies
} from "./options";
import type { CommitZoneProperties } from "./types";

type ZoneLayoutSectionProps = {
  onCommitZoneProperties: CommitZoneProperties;
  zone: Zone;
};

export function ZoneLayoutSection({
  onCommitZoneProperties,
  zone
}: ZoneLayoutSectionProps) {
  return (
    <section className="space-y-4 rounded-2xl border border-canvas-line bg-canvas-surface p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-canvas-ink">Layout</h3>
        <button
          aria-label={
            zone.autoResize
              ? "Disable automatic zone resizing"
              : "Enable automatic zone resizing"
          }
          aria-pressed={zone.autoResize ?? false}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line text-canvas-ink hover:bg-canvas-subtle ${
            zone.autoResize
              ? "bg-canvas-ink text-canvas-on-ink"
              : "text-canvas-muted hover:bg-canvas-subtle"
          }`}
          onClick={() =>
            onCommitZoneProperties({ autoResize: !zone.autoResize })
          }
          title={
            zone.autoResize
              ? "Disable automatic zone resizing"
              : "Enable automatic zone resizing"
          }
          type="button"
        >
          {zone.autoResize ? (
            <Zap aria-hidden="true" className="h-4 w-4" />
          ) : (
            <ZapOff aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </div>
      <div className="space-y-2">
        <div
          aria-label="Layout strategy"
          className="grid grid-cols-4 overflow-hidden rounded-xl border border-canvas-line"
          role="radiogroup"
        >
          {zoneLayoutStrategies.map(({ icon: Icon, id, label }) => {
            const selected = zone.layoutStrategy === id;

            return (
              <button
                key={id}
                aria-checked={selected}
                aria-label={label}
                className={`flex min-h-10 items-center justify-center border-canvas-line p-2 last:border-r-0 [&:not(:last-child)]:border-r ${
                  selected
                    ? "bg-canvas-ink text-canvas-on-ink"
                    : "text-canvas-muted hover:bg-canvas-subtle"
                }`}
                onClick={() => onCommitZoneProperties({ layoutStrategy: id })}
                role="radio"
                title={label}
                type="button"
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </button>
            );
          })}
        </div>
      </div>
      {isSplitLayoutStrategy(zone.layoutStrategy) ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-canvas-ink">Orientation</span>
            <button
              aria-label={
                zone.showSectionDividers
                  ? "Hide section dividers"
                  : "Show section dividers"
              }
              aria-pressed={zone.showSectionDividers ?? false}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line hover:bg-canvas-subtle ${
                zone.showSectionDividers
                  ? "bg-canvas-ink text-canvas-on-ink"
                  : "text-canvas-muted"
              }`}
              onClick={() =>
                onCommitZoneProperties({
                  showSectionDividers: !zone.showSectionDividers
                })
              }
              title={
                zone.showSectionDividers
                  ? "Hide section dividers"
                  : "Show section dividers"
              }
              type="button"
            >
              {zone.showSectionDividers ? (
                <Eye aria-hidden="true" className="h-4 w-4" />
              ) : (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>
          <div
            aria-label="Layout orientation"
            className="grid grid-cols-2 overflow-hidden rounded-xl border border-canvas-line"
            role="radiogroup"
          >
            {zoneLayoutOrientations.map(({ icon: Icon, id, label }) => {
              const selected = zone.layoutOrientation === id;

              return (
                <button
                  key={id}
                  aria-checked={selected}
                  aria-label={label}
                  className={`flex min-h-10 items-center justify-center border-canvas-line p-2 first:border-r ${
                    selected
                      ? "bg-canvas-ink text-canvas-on-ink"
                      : "text-canvas-muted hover:bg-canvas-subtle"
                  }`}
                  onClick={() =>
                    onCommitZoneProperties({
                      layoutOrientation: id as LayoutOrientation
                    })
                  }
                  role="radio"
                  title={label}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
