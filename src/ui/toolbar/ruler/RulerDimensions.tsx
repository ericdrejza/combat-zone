import { rulerSnapEnabled, snapRulerOrigin } from '@core/measurement/areaGeometry';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { selectRulerOptions, selectRulerDraft } from '@interaction/rulerState';
import { useDispatch, useSelector } from 'react-redux';
import { setRulerDraft } from '@interaction/interactionState';
import type { RootState } from '@store/store';
import { gridToWorld, worldToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';

export function RulerDimensions({ className }: { className: string }) {
  const dispatch = useDispatch();
  const draft = useSelector(selectRulerDraft), options = useSelector(selectRulerOptions);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const grid = encounter.grid;
  if (!draft || draft.points.length < 2 || options.shape !== 'rectangle') return null;
  const geometry = resolveGridGeometry(grid), factor = (grid.distancePerCell ?? 5) / geometry.cellSize;
  const origin = snapRulerOrigin(encounter, draft.points[0], options), snapped = rulerSnapEnabled(encounter, options);
  const rawEnd = draft.points[draft.points.length - 1];
  const endPoint = snapped && options.shape === 'rectangle' ? nearestGridVertex(encounter, rawEnd) : rawEnd;
  const a = worldToGrid(geometry, origin), b = worldToGrid(geometry, endPoint);
  const rectangle = options.shape === 'rectangle';
  const fields = rectangle ? ['Width', 'Height'] : ['Range'];
  return <>{fields.map((label, i) => {
    const radius = Math.hypot(b.x - a.x, b.y - a.y);
    const snappedRadius = snapped && (options.shape === 'circle' || options.shape === 'cone') ? Math.round(radius / geometry.cellSize) * geometry.cellSize : radius;
    const value = rectangle ? Math.abs(i ? b.y - a.y : b.x - a.x) * factor : snappedRadius * factor;
    return <label key={label} className="flex items-center gap-1 text-xs">{label}<input aria-label={`Ruler ${label.toLowerCase()}`} className={`${className} w-20`} type="number" min="0" step="any" value={Math.round(value * 100) / 100}
      onChange={event => {
        const n = event.currentTarget.valueAsNumber; if (!Number.isFinite(n) || n < 0) return;
        const amount = n / factor;
        const end = rectangle ? { ...b, [i ? 'y' : 'x']: (i ? a.y : a.x) + amount * (Math.sign(i ? b.y - a.y : b.x - a.x) || 1) }
          : { x: a.x + Math.cos(Math.atan2(b.y - a.y, b.x - a.x)) * amount, y: a.y + Math.sin(Math.atan2(b.y - a.y, b.x - a.x)) * amount };
        dispatch(setRulerDraft({ points: [origin, gridToWorld(geometry, end)], complete: true }));
      }} /></label>;
  })}</>;
}
