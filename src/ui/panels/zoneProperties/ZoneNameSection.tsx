import type { Zone } from "../../../entities/zone/types";
import { zoneNamePositions } from "./options";
import type { CommitZoneProperties } from "./types";

type ZoneNameSectionProps = {
  onCommitZoneProperties: CommitZoneProperties;
  zone: Zone;
};

export function ZoneNameSection({
  onCommitZoneProperties,
  zone
}: ZoneNameSectionProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-canvas-line bg-white p-3">
      <h3 className="font-semibold text-canvas-ink">Name</h3>
      <label className="block space-y-1">
        <span className="font-semibold text-canvas-ink">Zone name</span>
        <input
          className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
          defaultValue={zone.name}
          onBlur={(event) => {
            const name = event.currentTarget.value.trim() || zone.name;

            if (name !== zone.name) {
              onCommitZoneProperties({ name });
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          type="text"
        />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-2xl border border-canvas-line bg-white px-3 py-2">
        <span>
          <span className="block font-semibold text-canvas-ink">Show name</span>
        </span>
        <input
          checked={zone.showName}
          className="h-5 w-5 accent-canvas-ink"
          onChange={(event) =>
            onCommitZoneProperties({ showName: event.currentTarget.checked })
          }
          type="checkbox"
        />
      </label>
      {zone.showName ? (
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-canvas-ink">Position</span>
          <div
            aria-label="Zone name position"
            className="grid grid-cols-2 overflow-hidden rounded-xl border border-canvas-line bg-white"
            role="radiogroup"
          >
            {zoneNamePositions.map((position) => {
              const Icon = position.icon;
              const selected = zone.namePosition === position.id;

              return (
                <button
                  key={position.id}
                  aria-checked={selected}
                  aria-label={position.label}
                  className={`border-canvas-line p-2 odd:border-r [&:nth-child(-n+2)]:border-b ${
                    selected
                      ? "bg-canvas-ink text-white"
                      : "text-canvas-muted hover:bg-canvas-subtle"
                  }`}
                  onClick={() =>
                    onCommitZoneProperties({ namePosition: position.id })
                  }
                  role="radio"
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
