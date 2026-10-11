import type { EncounterState } from '@core/encounter/types';
import type { EncounterActionRecord } from '@core/history/types';

/** Spatial audit entries describe user actions without exposing internal action IDs. */
export function formatSpatialAction(action: EncounterActionRecord, after: EncounterState, actorNames: () => string): string | null {
  const adjustment = Array.isArray(action.payload.adjustedActorIds) && action.payload.adjustedActorIds.length ? ' Movement adjusted to the nearest open grid anchor.' : '';
  switch (action.type) {
    case 'movement.updateRules': return 'Canvas placement rules updated.';
    case 'grid.update': return 'Grid settings updated.';
    case 'grid.calibrate': return 'Grid aligned to the background.';
    case 'actor.moveSpatial': return action.payload.removedFromCanvas
      ? `${actorNames()} removed from the canvas.` : `${actorNames()} moved on the canvas.${adjustment}`;
    case 'actor.create': return !after.movementRules.zoneLocked ? `${actorNames()} placed on the canvas.${adjustment}` : null;
    default: return null;
  }
}
