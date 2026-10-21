import { createPortal } from "react-dom";
import { RulerPreviewPolyline } from './RulerPreviewPolyline';
import { RulerLabel } from './RulerLabel';
import { coneGeometry } from '@core/measurement/coneGeometry';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import type { ReactNode } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { RulerOptions, DiagonalCost } from '@core/measurement/types';
import { measureArea, rulerSnapEnabled, snapRulerOrigin } from '@core/measurement/areaGeometry';
import { measureRoute, projectPolyline } from '@core/measurement/distance';
import { formatDistance, abbreviateDistanceUnit } from '@core/measurement/distanceUnits';
import { worldToGrid, snapToGrid } from '@core/movement/gridGeometry';
import { resolveGridGeometry } from '@core/movement/gridScale';

const pointList = (points: LayoutPoint[]) => points.map(p => `${p.x},${p.y}`).join(' ');
export function RulerGraphic({ encounter, points, options, policy, name, children, onContextMenu, flexible = false, hitTarget }: {
  encounter: EncounterState; points: LayoutPoint[]; options: RulerOptions; policy: DiagonalCost; name?: string;
  hitTarget?: SVGGElement | null;
  flexible?: boolean; children?: ReactNode; onContextMenu?: (event: React.MouseEvent<SVGElement>) => void;
}) {
  const { preferences } = useCanvasPreferences();
  const grid = resolveGridGeometry(encounter.grid), unit = encounter.grid.distanceUnit ?? 'feet';
  const route = options.shape === 'path' ? measureRoute(encounter.grid, points, rulerSnapEnabled(encounter, options), policy) : null;
  const area = options.shape !== 'path' && points.length > 1 ? measureArea(encounter, points[0], points[points.length - 1], options, policy, preferences.showRulerArea, preferences.rulerCellCoverage) : null;
  const labelPoint = route?.points[route.points.length - 1] ?? points[points.length - 1];
  let detail = area ? formatDistance(area.distance, unit) : '';
  if (area && options.shape === 'cone') detail += ` · ${options.angle ?? (encounter.grid.type === 'square' || encounter.grid.type === 'isometric' ? 90 : 60)}°`;
  if (area && options.shape === 'circle') detail = `r ${detail}`;
  if (area && options.shape === 'rectangle') {
    const a = worldToGrid(grid, area.origin!), rawEnd = points[points.length - 1];
    const b = worldToGrid(grid, rulerSnapEnabled(encounter, options) ? nearestGridVertex(encounter, rawEnd) : rawEnd), factor = (encounter.grid.distancePerCell ?? 5) / grid.cellSize;
    detail = `${formatDistance(Math.abs(b.x - a.x) * factor, unit)} × ${formatDistance(Math.abs(b.y - a.y) * factor, unit)}`;
  }
  const label = route ? formatDistance(route.distance, unit) : detail + (area && preferences.showRulerArea ? ` · ${Number(area.area.toFixed(2))} ${abbreviateDistanceUnit(unit)}²` : '');
  const outlines = area?.outlines ?? (route ? [projectPolyline(encounter.grid, route.points.map(p => worldToGrid(grid, p)))] : []);
  // Context targets sit below actors; visual geometry remains in the overlay above them.
  const targets = onContextMenu ? <g stroke="transparent" strokeWidth={16} fill={area ? 'transparent' : 'none'} pointerEvents={area ? 'all' : 'stroke'}>
    {outlines.map((outline, i) => <polyline key={i} points={pointList(outline)} />)}
    {!children ? points.map((raw, i) => {
      const point = rulerMarker(encounter, raw, i, options, points.at(-1));
      return <circle key={i} cx={point.x} cy={point.y} r={4} fill="transparent" stroke="none" pointerEvents="all" />;
    }) : null}
  </g> : null;
  return <g stroke="currentColor" strokeWidth={2} fill="none" onContextMenu={onContextMenu}>
    <g pointerEvents="none">
      {outlines.map((outline, i) => <RulerPreviewPolyline key={i} points={pointList(outline)} area={!!area} flexible={flexible} />)}
      {area?.cells.map((cell, i) => <polygon key={i} points={pointList(projectPolyline(encounter.grid, cell.map(p => worldToGrid(grid, p)), true))} fill="currentColor" fillOpacity={0.25} />)}
      {labelPoint ? <RulerLabel text={name ? `${name} · ${label}` : label} point={labelPoint} bounds={encounter.canvasSize} interactive={!!onContextMenu} hitTarget={hitTarget} /> : null}
    </g>
    {targets && hitTarget ? createPortal(targets, hitTarget) : targets}
    {!children ? points.map((raw, i) => { const point = rulerMarker(encounter, raw, i, options, points.at(-1)); return <circle key={i} cx={point.x} cy={point.y} r={4} fill="currentColor" pointerEvents="none" />; }) : children}
  </g>;
}

export function rulerMarker(encounter: EncounterState, point: LayoutPoint, index: number, options: RulerOptions, target?: LayoutPoint) {
  if (index === 0 && options.shape === 'cone' && target) return coneGeometry(encounter, point, target).origin;
  if (index === 0) return snapRulerOrigin(encounter, point, options);
  return rulerSnapEnabled(encounter, options) && options.shape === 'path' ? snapToGrid(resolveGridGeometry(encounter.grid), point, 'medium') : point;
}
