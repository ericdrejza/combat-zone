import type { GridConfiguration } from '@core/movement/types';

export function GridMeasurementFields({ grid, onChange, className }: {
  grid: GridConfiguration; onChange: (grid: GridConfiguration) => void; className: string;
}) {
  const unit = grid.distanceUnit ?? 'feet';
  return <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold">Measurements</legend>
    <label className="space-y-1 text-sm">Distance per cell<input aria-label="Distance per cell" className={className} type="number" min="1" step="1"
      value={grid.distancePerCell ?? 5} onChange={event => onChange({ ...grid, distancePerCell: event.currentTarget.valueAsNumber })} /></label>
    <label className="space-y-1 text-sm">Distance unit<select aria-label="Distance unit" className={className} value={['feet', 'meters'].includes(unit) ? unit : 'custom'}
      onChange={event => onChange({ ...grid, distanceUnit: event.currentTarget.value === 'custom' ? 'units' : event.currentTarget.value })}>
      <option value="feet">Feet (ft)</option><option value="meters">Meters (m)</option><option value="custom">Custom</option></select></label>
    {!['feet', 'meters'].includes(unit) ? <label className="space-y-1 text-sm">Custom unit<input aria-label="Custom distance unit" className={className} value={unit}
      onChange={event => onChange({ ...grid, distanceUnit: event.currentTarget.value })} /></label> : null}
  </fieldset>;
}
