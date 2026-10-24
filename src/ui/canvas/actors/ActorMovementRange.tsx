import { useId, useMemo } from 'react';
import type { EncounterState } from '@core/encounter/types';
import type { Actor } from '@entities/actor/types';
import type { MovementPreferences } from '@core/measurement/types';
import type { LayoutPoint } from '@core/layout/types';
import { movementReachOutlines } from '@core/measurement/movementReach';

export function ActorMovementRange({ encounter, actor, origin, available, preferences, priorDiagonals }: {
  encounter: EncounterState; actor: Actor; origin: LayoutPoint; available: number; preferences: MovementPreferences; priorDiagonals: number;
}) {
  const filterId = useId().replace(/:/g, '');
  const outlines = useMemo(() => movementReachOutlines(encounter, { ...actor, spatialPosition: { x: origin.x, y: origin.y } }, available, preferences.diagonalCost, priorDiagonals),
    [encounter, actor, origin.x, origin.y, available, preferences.diagonalCost, priorDiagonals]);
  const path = outlines.map(points => `${points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('')}Z`).join('');
  return <g aria-label={`${actor.name} reachable area`} pointerEvents="none">
    <defs><filter id={filterId} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter></defs>
    <path d={path} fill="none" stroke="currentColor" strokeWidth={9} opacity={0.45} filter={`url(#${filterId})`} />
    <path d={path} fill="currentColor" fillOpacity={0.04} fillRule="evenodd" stroke="currentColor" strokeWidth={2} opacity={0.75} />
  </g>;
}
