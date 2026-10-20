import { formatDistance } from '@core/measurement/distanceUnits';
import { spatialActorRadius } from '@core/movement/gridGeometry';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { ActorMovementRange } from './ActorMovementRange';
import type { EncounterState } from '@core/encounter/types';
import { measureRoute, projectPolyline } from '@core/measurement/distance';
import { movementTrackingActive } from '@core/measurement/movementAccounting';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { worldToGrid } from '@core/movement/gridGeometry';
import { placeSpatialActors } from '@core/movement/movementStrategies';
import { useMovementPreferences } from '@ui/combat_preferences/useMovementPreferences';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { actorMovementWaypoints } from './actorMovementPaths';

export function ActorMovementOverlay({ encounter, drag }: { encounter: EncounterState; drag: ActorDragState | null }) {
  const { preferences } = useMovementPreferences();
  const { preferences: canvas } = useCanvasPreferences();
  if (!drag || drag.phase !== 'dragging' || encounter.movementRules.zoneLocked) return null;
  const paths = actorMovementWaypoints(encounter, drag), grid = resolveGridGeometry(encounter.grid);
  const targets = Object.fromEntries(drag.actorIds.flatMap(id => {
    const origin = encounter.actors.byId[id]?.spatialPosition;
    return origin ? [[id, { x: origin.x + drag.current.x - drag.start.x, y: origin.y + drag.current.y - drag.start.y }]] : [];
  }));
  const candidate = placeSpatialActors(encounter, targets);
  return <g aria-label="Actor movement preview" className="text-canvas-ink" style={{ color: canvas.rulerColor ?? undefined, opacity: canvas.rulerOpacity }}>
    {drag.actorIds.map(id => {
      const actor = encounter.actors.byId[id], start = actor?.spatialPosition, end = candidate.actors.byId[id]?.spatialPosition;
      if (!start || !end) return null;
      const tracked = movementTrackingActive(encounter, preferences, id), total = tracked ? encounter.initiativeTracker.movement?.[id] : undefined;
      const route = measureRoute(encounter.grid, [start, ...paths[id], end], encounter.movementRules.snapToGrid, preferences.diagonalCost, total?.diagonals, actor.size);
      const used = (total?.distance ?? 0) + route.distance, over = actor.movementLimit !== undefined && used > actor.movementLimit + 1e-7;
      const radius = spatialActorRadius(actor);
      const points = projectPolyline(encounter.grid, route.points.map(p => worldToGrid(grid, p)));
      return <g key={id} pointerEvents="none" className={over ? 'text-red-600 dark:text-red-400' : undefined}>
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth={3} strokeDasharray="6 4" />
        {actor.movementLimit !== undefined ? <ActorMovementRange encounter={encounter} actor={actor} available={Math.max(0, actor.movementLimit - (total?.distance ?? 0))} preferences={preferences} priorDiagonals={total?.diagonals ?? 0} /> : null}
        {canvas.showActorMovementDistance ? <text x={end.x + radius + 8} y={end.y + radius + 16} fill="currentColor" fontSize={16} aria-label={`${actor.name} movement distance`}>
          {formatDistance(route.distance, encounter.grid.distanceUnit ?? 'feet')}
        </text> : null}
      </g>;
    })}
  </g>;
}
