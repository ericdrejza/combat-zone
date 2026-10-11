import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ZONE_COLOR_PALETTE } from '@entities/zone/zoneColors';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';
import type { CommitZoneProperties } from './types';

type ZoneColorProperty = 'colorFill' | 'colorBorder' | 'colorEngagement';

type ColorPaletteProps = {
  disabled?: boolean;
  label: string;
  onCommitZoneProperties: CommitZoneProperties;
  property: ZoneColorProperty;
  value: string;
};

/** Each field shows its saved color; palette visibility is transient and selections commit once. */
export function ColorPalette({ disabled = false, label, onCommitZoneProperties, property, value }: ColorPaletteProps) {
  const [open, setOpen] = useState(false);
  const id = useId(), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [property, disabled]);
  const tooltip = `${open ? 'Close' : 'Choose'} ${label.toLowerCase()}`;
  return <div className="space-y-2" onKeyDown={event => {
    if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(false); opener.current?.focus(); }
  }}>
    <span className="font-semibold text-canvas-ink">{label}</span>
    <button ref={opener} aria-label={label} aria-expanded={open} aria-controls={id} title={tooltip} disabled={disabled}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-canvas-line bg-canvas-surface p-2 text-canvas-ink enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40"
      type="button" onClick={() => setOpen(!open)}>
      <span role="img" aria-label={`${label} preview ${value}`} className="h-6 w-10 shrink-0 rounded border border-canvas-line" style={{ backgroundColor: value }} />
      <span className="font-mono text-xs uppercase">{value}</span>
      {open ? <ChevronUp aria-hidden="true" className="ml-auto h-4 w-4" /> : <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />}
    </button>
    {open && !disabled ? <div id={id} aria-label={`${label} palette`} role="group" className="grid grid-cols-5 gap-2">
      {ZONE_COLOR_PALETTE.map(color => <TouchTooltip key={color} label={`${label} ${color}`}>
        <button aria-label={`${label} ${color}`} aria-pressed={value.toLowerCase() === color.toLowerCase()} title={`${label} ${color}`}
          className={`h-8 w-full rounded-full border enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${value.toLowerCase() === color.toLowerCase() ? 'border-canvas-ink ring-2 ring-canvas-ink/25' : 'border-canvas-line'}`}
          onClick={() => { onCommitZoneProperties({ [property]: color }); setOpen(false); opener.current?.focus(); }}
          style={{ backgroundColor: color }} type="button" />
      </TouchTooltip>)}
    </div> : null}
  </div>;
}
