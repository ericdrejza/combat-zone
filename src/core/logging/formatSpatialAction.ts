import type { EncounterState } from '@core/encounter/types';
import type { EncounterActionRecord } from '@core/history/types';
import { stringValue } from './logValueReaders';

/** Spatial audit entries describe user actions without exposing internal action IDs. */
export function formatSpatialAction(action: EncounterActionRecord, after: EncounterState, actorNames: () => string): string | null {
  switch (action.type) {
    case 'movement.changeStrategy': {
      const strategy = stringValue(action.payload.strategy) ?? after.movementStrategy;
      return `Movement changed to ${strategy.charAt(0).toUpperCase() + strategy.slice(1)}.`;
    }
    case 'grid.update': return 'Grid settings updated.';
    case 'grid.calibrate': return 'Grid aligned to the background.';
    case 'actor.moveSpatial': return action.payload.removedFromCanvas
      ? `${actorNames()} removed from the canvas.` : `${actorNames()} moved on the canvas.`;
    case 'actor.create': return after.movementStrategy !== 'zone' ? `${actorNames()} placed on the canvas.` : null;
    default: return null;
  }
}
