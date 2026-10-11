import { isSquareTopology } from '@core/movement/gridProjection';
import { getActorRadius } from '@core/layout/actorFootprints';
import type { ReactNode } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import type { LayoutPoint } from '@core/layout/types';
import { actorAnchorCells } from '@core/movement/gridTopology';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { cellBoundarySegments } from '@core/movement/gridEdgeCompletion';

export function ActorTrim({ encounter, actor, point, children }: { encounter: EncounterState; actor: Actor; point: LayoutPoint; children: (clipId?: string) => ReactNode }) {
  if (!encounter.movementRules.trimTokens || !encounter.movementRules.snapToGrid || isSquareTopology(encounter.grid.type) || (actor.size !== 'large' && actor.size !== 'xLarge')) return <>{children()}</>;
  const radius = getActorRadius(actor);
  const id = `actor-trim-${actor.id}`, grid = resolveGridGeometry(encounter.grid);
  const local = (p: LayoutPoint) => `${p.x - point.x},${p.y - point.y}`;
  const path = actorAnchorCells(encounter, point, actor.size).map(cell => {
    const segments = cellBoundarySegments(grid, cell.polygon);
    return `M${local(segments[0].start)} ${segments.map(segment => encounter.grid.warp ? `Q${local(segment.control)} ${local(segment.end)}` : `L${local(segment.end)}`).join(' ')} Z`;
  }).join(' ');
  return <><defs><clipPath id={id} clipPathUnits="userSpaceOnUse"><path d={path} /></clipPath></defs>
    {actor.shape !== 'circle' ? <rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} fill="transparent" pointerEvents="all" /> : <circle r={radius} fill="transparent" pointerEvents="all" />}
    {children(id)}</>;
}
