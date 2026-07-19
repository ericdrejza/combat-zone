import type { LayoutOrientation } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
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
    <section className="space-y-4 rounded-2xl border border-canvas-line bg-white p-3">
      <h3 className="font-semibold text-canvas-ink">Layout</h3>
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
                    ? "bg-canvas-ink text-white"
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
          <span className="font-semibold text-canvas-ink">Orientation</span>
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
                      ? "bg-canvas-ink text-white"
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
