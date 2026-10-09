import type { Actor } from "@entities/actor/types";
import type { StatusMarker } from "@ui/status/markerCatalog";
import { StatusMarkerToggle } from "@ui/status/StatusMarkerToggle";

export function MarkerSection({ title, actors, markers, disabled, onToggle, subsections }: {
  title: string; actors: Actor[]; markers: StatusMarker[]; disabled: boolean; onToggle: (id: string) => void;
  subsections?: { title: string; markers: StatusMarker[] }[];
}) {
  return <fieldset className="border-t border-canvas-line pt-3">
    <legend className="pr-2 text-sm font-semibold">{title}</legend>
    {subsections ? <div className="space-y-3">{subsections.filter((section) => section.markers.length).map((section) => <fieldset key={section.title}>
      <legend className="mb-1 text-xs font-medium text-canvas-muted">{section.title}</legend>
      <MarkerToggles actors={actors} markers={section.markers} disabled={disabled} onToggle={onToggle} />
    </fieldset>)}</div> : <MarkerToggles actors={actors} markers={markers} disabled={disabled} onToggle={onToggle} />}
  </fieldset>;
}

function MarkerToggles({ actors, markers, disabled, onToggle }: {
  actors: Actor[]; markers: StatusMarker[]; disabled: boolean; onToggle: (id: string) => void;
}) {
  return <div className="flex flex-wrap gap-x-2 gap-y-1">
      {markers.map(({ id, label, Icon }) => {
        const count = actors.filter((actor) => actor.statusEffects.includes(id)).length;
        const pressed = count === 0 ? false : count === actors.length ? true : "mixed";
        const tooltip = `${label}${pressed === "mixed" ? " (some selected actors)" : ""}${disabled ? " — read-only encounter" : ""}`;
        return <StatusMarkerToggle key={id} label={label} tooltip={tooltip} Icon={Icon} pressed={pressed} disabled={disabled} onClick={() => onToggle(id)} />;
      })}
    </div>;
}
