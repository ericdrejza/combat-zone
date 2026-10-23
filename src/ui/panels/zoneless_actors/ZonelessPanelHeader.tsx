import { ChevronDown, ChevronUp, ListChecks, RotateCcw, UsersRound } from "lucide-react";
import type { ActorGroup } from "./zonelessActorGroups";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

const buttonClass = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current hover:bg-canvas hover:text-canvas-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit";

export function SelectAllZonelessButton({ disabled, onSelect }: { disabled: boolean; onSelect: () => void }) {
  return <TouchTooltip label="Select all Zoneless actors"><button type="button" title="Select all Zoneless actors"
    aria-label="Select all Zoneless actors" className={buttonClass} disabled={disabled} onClick={onSelect}>
    <ListChecks size={16} aria-hidden="true" />
  </button></TouchTooltip>;
}

export function ZonelessFactionButton({ group, disabled, onSelect }: { group: ActorGroup; disabled: boolean; onSelect: () => void }) {
  return <button type="button" aria-label={`Select all ${group.label} Zoneless actors`} title={`Select all ${group.label} Zoneless actors`}
    disabled={disabled} onClick={onSelect}
    className="rounded px-2 py-1 text-inherit hover:bg-canvas hover:text-canvas-ink focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-inherit">
    {group.label}
  </button>;
}

type Props = {
  expanded: boolean; onToggle: () => void; headerClickExpansion: boolean;
  groupByFaction: boolean; onGroupChange: (value: boolean) => void;
  count: number; contrastColor: string; isResized: boolean; onResetSize: () => void;
  canSelect: boolean; onSelectAll: () => void;
};

/** Header actions remain independent of the optional expansion target. */
export function ZonelessPanelHeader(props: Props) {
  const { expanded, onToggle, headerClickExpansion, groupByFaction, onGroupChange, count, contrastColor } = props;
  const label = expanded ? "Collapse zoneless actors" : "Expand zoneless actors";
  const title = <><UsersRound aria-hidden="true" size={16} /><span className="truncate text-sm font-semibold">Zoneless</span>
    <span className="rounded-full px-2 py-0.5 text-xs" style={{ outline: `1px solid ${contrastColor}` }}>{count}</span></>;
  return <div className="flex flex-wrap items-center gap-2" onClick={event => {
    if (headerClickExpansion && event.target === event.currentTarget) onToggle();
  }}>
    {headerClickExpansion ? <button type="button" aria-expanded={expanded} aria-label="Toggle Zoneless panel from header"
      onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 hover:bg-canvas hover:text-canvas-ink focus-visible:outline focus-visible:outline-2">{title}</button>
      : <div className="flex min-w-0 flex-1 items-center gap-2">{title}</div>}
    {expanded ? <>
      <label className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-canvas hover:text-canvas-ink">
        <input aria-label="Group by faction" checked={groupByFaction} className="h-4 w-4 accent-canvas-ink"
          onChange={event => onGroupChange(event.target.checked)} type="checkbox" />Group by faction
      </label>
      <SelectAllZonelessButton disabled={!props.canSelect || !count} onSelect={props.onSelectAll} />
    </> : null}
    {props.isResized ? <TouchTooltip label="Reset panel size"><button aria-label="Reset zoneless actors panel size"
      title="Reset panel size" className={buttonClass} onClick={props.onResetSize} type="button"><RotateCcw size={15} /></button></TouchTooltip> : null}
    <TouchTooltip label={label}><button aria-expanded={expanded} aria-label={label} title={label} className={buttonClass}
      onClick={onToggle} type="button">{expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button></TouchTooltip>
  </div>;
}
