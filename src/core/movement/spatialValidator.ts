import { anchorKey } from './gridTopology';
import { zoneSnappingValid } from './zoneVertexSnapping';
import { packGridZone } from './gridZonePacking';
import { legacyActorRadius } from './legacyGridScale';
import type { EncounterState } from '@core/encounter/types';
import type { ValidationMessage, Validator } from '@core/validation/types';
import { footprintFits, snapToGrid, spatialActorRadius } from './gridGeometry';
import { isSpatial } from './movementStrategies';
import { resolveGridGeometry } from './gridScale';
import { validGrid, validMovementRules } from './types';
import { warpFitsCanvas } from './gridWarp';
import { validBackgroundFrame } from '@core/encounter/backgroundFrame';
import { isSimplePolygon } from '@core/layout/polygonValidity';
import { isZonePolygonSizeValid } from '@core/layout/zoneSize';

/** Structural grid and canvas fit rules hold even when advisory validation is off. */
export const SpatialValidator: Validator<EncounterState> = {
  id: 'SpatialValidator', runsInOffMode: true,
  validate(_action, { state, nextState = state }) {
    const messages: ValidationMessage[] = [];
    const legacy = Number(nextState.schemaVersion) < 21;
    const geometry = legacy ? nextState.grid : resolveGridGeometry(nextState.grid);
    if (nextState.gridCoverage !== undefined && (nextState.backgroundImage !== null || !validBackgroundFrame(nextState.gridCoverage, nextState.canvasSize)))
      messages.push({ code: 'grid.invalidCoverage', message: 'Grid coverage must fit inside the canvas without a background image.', severity: 'error' });
    if (nextState.backgroundImage?.frame !== undefined && !validBackgroundFrame(nextState.backgroundImage.frame, nextState.canvasSize)) {
      messages.push({ code: 'background.invalidFrame', message: 'Background placement must fit completely inside the canvas.', severity: 'error' });
    }
    if (!validGrid(nextState.grid) || !warpFitsCanvas(geometry, nextState.canvasSize) || !validMovementRules(nextState.movementRules)) {
      messages.push({ code: 'grid.invalidConfiguration', message: 'Grid configuration is invalid.', severity: 'error' });
    } else if (isSpatial(nextState)) {
      const occupied = new Set<string>();
      for (const actor of Object.values(nextState.actors.byId)) {
        const point = actor.spatialPosition;
        if (!point) continue;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !footprintFits(point, (legacy ? legacyActorRadius(actor, geometry, point) : spatialActorRadius(actor)), nextState.canvasSize)) {
          messages.push({ code: 'movement.outsideCanvas', message: `${actor.name} must fit completely inside the canvas.`, severity: 'error' });
        } else if (nextState.movementRules.snapToGrid) {
          const key = anchorKey(point);
          if (!nextState.movementRules.allowOverlap && occupied.has(key)) messages.push({ code: 'movement.anchorOccupied', message: `${actor.name} must use an open grid anchor.`, severity: 'error' });
          occupied.add(key);
          const snapped = snapToGrid(geometry, point, actor.size);
          if (Math.hypot(point.x - snapped.x, point.y - snapped.y) > 1e-6) messages.push({ code: 'movement.unsnapped', message: `${actor.name} must align with the grid.`, severity: 'error' });
        }
      }
    }
    if (validMovementRules(nextState.movementRules) && validGrid(nextState.grid)) {
      for (const id of nextState.zones.allIds) {
        const zone = nextState.zones.byId[id];
        if (nextState.movementRules.snapZoneVertices && (!isSimplePolygon(zone.polygon) || !isZonePolygonSizeValid(zone.polygon))) messages.push({ code: 'zone.invalidSnappedGeometry', message: `${zone.name} cannot collapse or cross its own sides when snapped.`, severity: 'error' });
        if (nextState.movementRules.snapZoneVertices && !zoneSnappingValid(nextState, zone)) messages.push({ code: 'zone.unsnappedVertices', message: `${zone.name} must align its drawing controls with grid vertices.`, severity: 'error' });
        if (nextState.movementRules.zoneLocked && nextState.movementRules.snapToGrid && !packGridZone(nextState, id).fits) messages.push({ code: 'layout.gridZoneNoSpace', message: `Actors cannot fit inside ${zone.name} without sharing grid cells.`, severity: 'error' });
      }
    }
    return { valid: messages.length === 0, messages, blocked: messages.length > 0 };
  }
};
