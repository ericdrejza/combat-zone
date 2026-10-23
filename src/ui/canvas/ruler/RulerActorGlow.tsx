import type { AreaMeasurement } from '@core/measurement/areaGeometry';
import { memo, useId } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { DiagonalCost, RulerOptions } from '@core/measurement/types';
import { actorOverlapsRuler, rulerOverlapAreas } from '@core/measurement/rulerActorOverlap';
import type { RulerCellCoverage } from '@core/measurement/cellCoverage';
import { projectGridPoint } from '@core/movement/gridProjection';
import type { ActorRenderPlacement } from '@ui/canvas/actors/actorCanvasLayout';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { getDraggedPoint } from '@ui/canvas/actors/actorDragPoint';
import { transformZoneActorPoint, type ActorPlacementTranslation } from '@ui/canvas/actors/actorPlacementTranslation';

/** Pure derived overlay: shares preview geometry and rendered actor positions without durable overlap state. */
export const RulerActorGlow = memo(function RulerActorGlow({ encounter, points, options, policy, coverage, placements, drag, translation, projectTokens, intensity, area }: {
  encounter: EncounterState; points: LayoutPoint[]; options: RulerOptions; policy: DiagonalCost;
  coverage: RulerCellCoverage; placements: ActorRenderPlacement[]; drag?: ActorDragState | null;
  translation?: ActorPlacementTranslation | null; projectTokens: boolean; intensity: number; area?: AreaMeasurement | null;
}) {
  const id = useId().replace(/:/g, '');
  if (!placements.length || intensity === 0 || !(options.highlightActors ?? options.shape !== 'path')) return null;
  const areas = area ? [area] : rulerOverlapAreas(encounter, points, options, policy, coverage);
  const rotation = encounter.grid.rotation * Math.PI / 180;
  return <g opacity={intensity} pointerEvents="none" aria-label="Ruler actor highlights">
    <defs><filter id={id} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" /></filter></defs>
    {placements.map(({ actor, point: base, radius }) => {
      const point = getDraggedPoint(actor.id, transformZoneActorPoint(base, actor.currentZoneId, translation), drag ?? null);
      const offsets = actor.shape === 'circle'
        ? Array.from({ length: 128 }, (_, i) => ({ x: radius * Math.cos(i * Math.PI / 64), y: radius * Math.sin(i * Math.PI / 64) }))
        : [{ x: -radius, y: -radius }, { x: radius, y: -radius }, { x: radius, y: radius }, { x: -radius, y: radius }];
      const footprint = offsets.map(offset => {
        if (projectTokens && encounter.grid.type === 'isometric') {
          const projected = projectGridPoint(encounter.grid, offset);
          offset = { x: projected.x * Math.cos(rotation) - projected.y * Math.sin(rotation), y: projected.x * Math.sin(rotation) + projected.y * Math.cos(rotation) };
        }
        return { x: point.x + offset.x, y: point.y + offset.y };
      });
      if (!actorOverlapsRuler(encounter, actor, point, footprint, areas)) return null;
      return <polygon key={actor.id} data-ruler-highlight-actor={actor.id} points={footprint.map(p => `${p.x},${p.y}`).join(' ')}
        stroke="currentColor" strokeWidth={10} fill="none" filter={`url(#${id})`} />;
    })}
  </g>;
});
