import type { GridLineStyle } from '@core/movement/types';

export function GridLineStyleField({ value = 'solid', onChange, className }: {
  value?: GridLineStyle; onChange: (style: GridLineStyle) => void; className: string;
}) {
  return <label className="block space-y-1 text-sm">Line style<select aria-label="Grid line style" className={className} value={value}
    onChange={event => onChange(event.currentTarget.value as GridLineStyle)}>
    <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="crosshair">Crosshair</option>
  </select></label>;
}
