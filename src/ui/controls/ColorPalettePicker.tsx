import { RecentColorSwatches } from "./RecentColorSwatches";
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ZONE_COLOR_PALETTE } from '@entities/zone/zoneColors';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';


type ColorPalettePickerProps = {
  children?: ReactNode;
  controls?: ReactNode;
  presets?: readonly string[];
  recentColors?: string[];
  onRecentColor?: (color: string) => void;
  beforeSwatches?: ReactNode;
  displayValue?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
  label: string;
  showLabel?: boolean;
  labelAction?: ReactNode;
  onChange: (color: string) => void;
  value: string;
};

/** Each field shows its saved color; palette visibility is transient and selections commit once. */
export function ColorPalettePicker({ disabled = false, closeOnSelect = true, label, showLabel = true, labelAction, onChange, value, displayValue, children, controls, beforeSwatches, presets = ZONE_COLOR_PALETTE, recentColors, onRecentColor }: ColorPalettePickerProps) {
  const [open, setOpen] = useState(false);
  const id = useId(), opener = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [label, disabled]);
  const tooltip = `${open ? 'Close' : 'Choose'} ${label.toLowerCase()}`;
  return <div className="space-y-2" onKeyDown={event => {
    if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(false); opener.current?.focus(); }
  }}>
    {showLabel || labelAction ? <div className="flex items-center justify-between gap-2">{showLabel ? <span className="font-semibold text-canvas-ink">{label}</span> : null}{labelAction}</div> : null}
    <button ref={opener} aria-label={label} aria-expanded={open} aria-controls={id} title={tooltip} disabled={disabled}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-canvas-line bg-canvas-surface p-2 text-canvas-ink enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40"
      type="button" onClick={() => setOpen(!open)}>
      <span role="img" aria-label={`${label} preview ${value}`} className="h-6 w-10 shrink-0 rounded border border-canvas-line" style={{ backgroundColor: value }} />
      <span className="font-mono text-xs uppercase">{displayValue ?? value}</span>
      {open ? <ChevronUp aria-hidden="true" className="ml-auto h-4 w-4" /> : <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4" />}
    </button>
    {(open && !disabled) || controls ? <div id={id} aria-label={`${label} palette`} role="group" className="space-y-3">
      {open && !disabled ? beforeSwatches : null}
      {controls}
      {open && !disabled ? <>
        <div className="grid w-full max-w-[14rem] grid-cols-7 gap-1">
        {presets.map(color => <TouchTooltip key={color} label={`${label} ${color}`}>
          <button aria-label={`${label} ${color}`} aria-pressed={value.toLowerCase() === color.toLowerCase()} title={`${label} ${color}`}
            className={`aspect-square w-full rounded-md border enabled:hover:ring-2 enabled:hover:ring-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${value.toLowerCase() === color.toLowerCase() ? 'border-canvas-ink ring-2 ring-canvas-ink/25' : 'border-canvas-line'}`}
            onClick={() => { onChange(color); if (closeOnSelect) { setOpen(false); opener.current?.focus(); } }}
            style={{ backgroundColor: color }} type="button" />
        </TouchTooltip>)}
        </div>
        {recentColors ? <RecentColorSwatches label={label} colors={recentColors} value={value} onChange={color => {
          (onRecentColor ?? onChange)(color);
          if (closeOnSelect) { setOpen(false); opener.current?.focus(); }
        }} /> : null}
        {children}
      </> : null}
    </div> : null}
  </div>;
}
