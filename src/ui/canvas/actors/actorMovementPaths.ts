import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

export const ADD_MOVEMENT_WAYPOINT_EVENT = 'combat-zone:add-movement-waypoint';
/** Translate one pointer path for each selected actor without storing duplicate origins. */
export function actorMovementWaypoints(state: EncounterState, drag: ActorDragState): Record<string, LayoutPoint[]> {
  return Object.fromEntries(drag.actorIds.map(id => {
    const origin = drag.originPointsByActorId?.[id] ?? state.actors.byId[id]?.spatialPosition ?? drag.start;
    return [id, (drag.waypoints ?? []).map(p => ({ x: origin.x + p.x - drag.start.x, y: origin.y + p.y - drag.start.y }))];
  }));
}
