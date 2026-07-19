import { Eye, EyeOff } from "lucide-react";

import type { Zone } from "@entities/zone/types";
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
      <div className="flex justify-between">
        <h3 className="font-semibold text-canvas-ink">Name</h3>
        <div className="flex">
            <button
              aria-label={zone.showName ? "Hide zone name" : "Show zone name"}
              aria-pressed={zone.showName}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line text-canvas-ink hover:bg-canvas-subtle
                ${zone.showName
                    ? "bg-canvas-ink text-white"
                    : "text-canvas-muted hover:bg-canvas-subtle"
                }`
              }
              onClick={() => onCommitZoneProperties({ showName: !zone.showName })}
              title={zone.showName ? "Hide zone name" : "Show zone name"}
              type="button"
            >
              {zone.showName ? (
                <Eye aria-hidden="true" className="h-4 w-4" />
              ) : (
                <EyeOff aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          </div>
      </div>
      <label className="block space-y-1">
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
      <div className="">
        {zone.showName ? (
          <div
            aria-label="Zone name position"
            className="grid grid-cols-4 overflow-hidden rounded-xl border border-canvas-line bg-white"
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
                  className={`flex justify-center items-center border-canvas-line p-2 odd:border-r [&:nth-child(-n+2)]:border-b ${
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
        ) : null}
      </div>
    </section>
  );
}
