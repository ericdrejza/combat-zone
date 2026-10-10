import type { EncounterState } from '@core/encounter/types';
import type { ValidationMessage, Validator } from '@core/validation/types';
import { footprintFits, snapToGrid, spatialActorRadius } from './gridGeometry';
import { isSpatial } from './movementStrategies';
import { validGrid } from './types';
import { warpFitsCanvas } from './gridWarp';
import { validBackgroundFrame } from '@core/encounter/backgroundFrame';

/** Structural grid and canvas fit rules hold even when advisory validation is off. */
export const SpatialValidator: Validator<EncounterState> = {
  id: 'SpatialValidator', runsInOffMode: true,
  validate(_action, { state, nextState = state }) {
    const messages: ValidationMessage[] = [];
    if (nextState.gridCoverage !== undefined && (nextState.backgroundImage !== null || !validBackgroundFrame(nextState.gridCoverage, nextState.canvasSize)))
      messages.push({ code: 'grid.invalidCoverage', message: 'Grid coverage must fit inside the canvas without a background image.', severity: 'error' });
    if (nextState.backgroundImage?.frame !== undefined && !validBackgroundFrame(nextState.backgroundImage.frame, nextState.canvasSize)) {
      messages.push({ code: 'background.invalidFrame', message: 'Background placement must fit completely inside the canvas.', severity: 'error' });
    }
    if (!validGrid(nextState.grid) || !warpFitsCanvas(nextState.grid, nextState.canvasSize) || !['zone', 'grid', 'free'].includes(nextState.movementStrategy)) {
      messages.push({ code: 'grid.invalidConfiguration', message: 'Grid configuration is invalid.', severity: 'error' });
    } else if (isSpatial(nextState)) {
      for (const actor of Object.values(nextState.actors.byId)) {
        const point = actor.spatialPosition;
        if (!point) continue;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !footprintFits(point, spatialActorRadius(actor, nextState.grid, point), nextState.canvasSize)) {
          messages.push({ code: 'movement.outsideCanvas', message: `${actor.name} must fit completely inside the canvas.`, severity: 'error' });
        } else if (nextState.movementStrategy === 'grid') {
          const snapped = snapToGrid(nextState.grid, point, actor.size);
          if (Math.hypot(point.x - snapped.x, point.y - snapped.y) > 1e-6) messages.push({ code: 'movement.unsnapped', message: `${actor.name} must align with the grid.`, severity: 'error' });
        }
      }
    }
    return { valid: messages.length === 0, messages, blocked: messages.length > 0 };
  }
};
