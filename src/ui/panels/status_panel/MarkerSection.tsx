import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { Actor } from "@entities/actor/types";
import type { StatusMarker } from "@ui/status/markerCatalog";
import { StatusMarkerToggle } from "@ui/status/StatusMarkerToggle";
import { useStatusDashboard } from "./StatusDashboardContext";

export function MarkerSection({ title, actors, markers, disabled, onToggle, subsections, collapsible = false, dividerBefore }: {
  title: string; actors: Actor[]; markers: StatusMarker[]; disabled: boolean; onToggle: (id: string) => void;
  subsections?: { title: string; markers: StatusMarker[] }[];
  collapsible?: boolean;
  dividerBefore?: string;
}) {
  const dashboard = useStatusDashboard();
  const [expanded, setExpanded] = useState(true);
  const contentId = useId();
  const collapsed = collapsible && !expanded;
  const pairedGroups = collapsed || dashboard;
  const visibleMarkers = (items: StatusMarker[]) => collapsed
    ? items.filter(({ id }) => actors.some((actor) => actor.statusEffects.includes(id)))
    : items;
  return <fieldset className={`min-w-0 border-t border-canvas-line pt-3 ${dashboard ? subsections ? "max-w-2xl" : "w-fit max-w-sm" : ""}`}>
    <legend className={`${collapsible ? "w-full" : "pr-2"} text-sm font-semibold`}>{collapsible ? <button type="button" aria-expanded={expanded} aria-controls={contentId}
      className="inline-flex w-full items-center justify-between gap-2 rounded text-canvas-ink hover:text-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
      onClick={() => setExpanded((current) => !current)}>
      <span>{title}</span><span aria-hidden="true" className="min-w-0 flex-1 border-t border-canvas-line" />
      {expanded ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />}
    </button> : title}</legend>
    <div id={contentId}>
    {subsections ? <div className={pairedGroups ? "flex flex-wrap gap-y-3" : "space-y-3"}>{subsections.map((section) => ({ ...section, markers: visibleMarkers(section.markers) })).filter((section) => section.markers.length).map((section) => <fieldset key={section.title} className={pairedGroups ? `w-0 min-w-[50%] max-w-full flex-auto ${section.title === "Debuffs" ? "border-l border-canvas-line pl-2" : "pr-2"}` : "min-w-0"}>
      <legend className="mb-1 text-xs font-medium text-canvas-muted">{section.title}</legend>
      <MarkerToggles actors={actors} markers={section.markers} disabled={disabled} onToggle={onToggle} threeColumns={collapsed} />
    </fieldset>)}</div> : <MarkerToggles actors={actors} markers={visibleMarkers(markers)} disabled={disabled} onToggle={onToggle} dividerBefore={dividerBefore} />}
    </div>
  </fieldset>;
}

function MarkerToggles({ actors, markers, disabled, onToggle, threeColumns = false, dividerBefore }: {
  actors: Actor[]; markers: StatusMarker[]; disabled: boolean; onToggle: (id: string) => void;
  threeColumns?: boolean;
  dividerBefore?: string;
}) {
  return <div className={threeColumns ? "grid w-full max-w-[6.5rem] grid-cols-3 gap-1" : "flex w-full min-w-0 max-w-full flex-wrap gap-x-2 gap-y-1"}>
      {markers.map(({ id, label, Icon }) => {
        const count = actors.filter((actor) => actor.statusEffects.includes(id)).length;
        const pressed = count === 0 ? false : count === actors.length ? true : "mixed";
        const tooltip = `${label}${pressed === "mixed" ? " (some selected actors)" : ""}${disabled ? " — read-only encounter" : ""}`;
        const toggle = <StatusMarkerToggle key={id} label={label} tooltip={tooltip} Icon={Icon} pressed={pressed} disabled={disabled} onClick={() => onToggle(id)} />;
        return id === dividerBefore ? <span key={id} className="inline-flex border-l border-canvas-line pl-2">{toggle}</span> : toggle;
      })}
    </div>;
}
