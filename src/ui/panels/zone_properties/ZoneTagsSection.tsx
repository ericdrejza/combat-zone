import type { Zone } from "../../../entities/zone/types";
import { parseTags } from "./options";
import type { CommitZoneProperties } from "./types";

type ZoneTagsSectionProps = {
  onCommitZoneProperties: CommitZoneProperties;
  zone: Zone;
};

export function ZoneTagsSection({
  onCommitZoneProperties,
  zone
}: ZoneTagsSectionProps) {
  return (
    <label className="block space-y-1">
      <span className="font-semibold text-canvas-ink">Tags</span>
      <input
        className="w-full rounded-xl border border-canvas-line bg-white px-3 py-2"
        defaultValue={zone.tags.join(", ")}
        onBlur={(event) => {
          const tags = parseTags(event.currentTarget.value);

          if (tags.join("|") !== zone.tags.join("|")) {
            onCommitZoneProperties({ tags });
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
  );
}
