import type { LayoutOrientation } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import {
  isSplitLayoutStrategy,
  zoneLayoutOrientations,
  zoneLayoutStrategies
} from "./options";
import type { CommitZoneProperties } from "./types";

const orientationLabels: Record<LayoutOrientation, string> = {
  LEFT_RIGHT: "Left -> Right",
  TOP_BOTTOM: "Top -> Bottom"
};

type ZoneLayoutSectionProps = {
  onCommitZoneProperties: CommitZoneProperties;
  zone: Zone;
};

export function ZoneLayoutSection({
  onCommitZoneProperties,
  zone
}: ZoneLayoutSectionProps) {
  return (
    <>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Layout strategy</span>
        <select
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
          onChange={(event) =>
            onCommitZoneProperties({
              layoutStrategy: event.currentTarget.value as Zone["layoutStrategy"]
            })
          }
          value={zone.layoutStrategy}
        >
          {zoneLayoutStrategies.map((strategy) => (
            <option key={strategy} value={strategy}>
              {strategy}
            </option>
          ))}
        </select>
      </label>
      {isSplitLayoutStrategy(zone.layoutStrategy) ? (
        <label className="block space-y-1">
          <span className="font-semibold text-canvas-ink">Layout orientation</span>
          <select
            className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
            onChange={(event) =>
              onCommitZoneProperties({
                layoutOrientation: event.currentTarget.value as LayoutOrientation
              })
            }
            value={zone.layoutOrientation}
          >
            {zoneLayoutOrientations.map((orientation) => (
              <option key={orientation} value={orientation}>
                {orientationLabels[orientation]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}
