import { commitZoneReshape } from "./commitZoneReshape";
import { consumeEncounterPreparation } from "@core/history/encounterOperations";
import { zoneSnappingValid } from '@core/movement/zoneVertexSnapping';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/runtimeEncounterChange';
import { selectEntity } from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import {
  logEncounterValidationBlock,
  logEncounterValidationFailure
} from '@store/encounterLogSlice';
import { cacheActorRenderPlacementsForZoneMove } from '../actors/actorPlacementTranslation';
import {
  canCommitZonePolygon as canCommitZonePolygonForCollection
} from '../zones/zoneGeometry';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import type { MouseUpHandlerInput } from './mouseUpTypes';
import { resolveActorPlacements } from '@ui/canvas/actors/resolveActorPlacements';
import type { ActorRenderPlacement } from '@ui/canvas/actors/actorCanvasLayout';
import { setOptimisticActorPlacement } from '@ui/canvas/actors/actorPlacementOptimisticState';

const INVALID_POLYGON_MESSAGE =
  'A zone must remain within the canvas and must not overlap another zone.';

function commitZoneMove(input: MouseUpHandlerInput): boolean {
  const { encounter, zoneDrag } = input;
  // A committed move is retained only for its visual settling frame. It must
  // not intercept the release of a subsequent resize or vertex edit.
  if (!zoneDrag || zoneDrag.phase !== 'dragging') return false;
  const revision = input.zoneGestureRevisionRef.current;
  if (zoneDrag.hasMoved) {
    const nextPolygon = input.getDisplayedPolygon(
      encounter.zones.byId[zoneDrag.zoneId]
    );
    if (nextPolygon.every((point, i) => Math.hypot(point.x - zoneDrag.originalPolygon[i].x, point.y - zoneDrag.originalPolygon[i].y) < 1e-6)) {
      // Geometry owns its settling animation. A no-op drop must release the
      // gesture immediately rather than wait for a group-offset animation.
      input.setZoneDrag(null);
      return true;
    }
    const movedZone = { ...encounter.zones.byId[zoneDrag.zoneId], polygon: nextPolygon };
    if (encounter.movementRules.snapZoneVertices && !zoneSnappingValid(encounter, movedZone)) {
      logEncounterValidationFailure(input.dispatch, encounter, {
        actionType: 'zone.move', code: 'zone.unsnappedVertices',
        message: 'This move cannot preserve the Zone shape and keep its vertices snapped to the warped grid.',
        payload: { polygon: nextPolygon, zoneId: zoneDrag.zoneId }
      });
      input.setZoneDrag(null);
      return true;
    }
    if (
      !canCommitZonePolygonForCollection(
        nextPolygon,
        encounter.zones,
        zoneDrag.zoneId,
        encounter.canvasSize
      )
    ) {
      logEncounterValidationFailure(input.dispatch, encounter, {
        actionType: 'zone.move',
        code: 'zone.invalidPolygonPlacement',
        message: INVALID_POLYGON_MESSAGE,
        payload: { polygon: nextPolygon, zoneId: zoneDrag.zoneId }
      });
      input.setZoneDrag(null);
      return true;
    }

    const nextEncounter = updateZonePolygon(
      encounter,
      zoneDrag.zoneId,
      nextPolygon
    );
    // Let presentation snap immediately; the encounter stays unchanged until
    // validation accepts this candidate. Rejection restores the original target.
    input.setZoneDrag({ ...zoneDrag, phase: 'validating', previewPolygon: nextPolygon });
    const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter,
      action: createEncounterActionRecord('zone.move', { polygon: nextPolygon, zoneId: zoneDrag.zoneId }) });
    const placements = resolveActorPlacements(encounter);
    const apply = (resolved: Awaited<typeof prepared>, sourcePlacements: ActorRenderPlacement[]) => input.dispatch((_dispatch, getState) => {
      if (input.zoneGestureRevisionRef.current !== revision) return;
      if (!isPersistenceWritable() || getState().encounter.present !== encounter || logEncounterValidationBlock(input.dispatch, resolved)) {
        input.setZoneDrag(null);
        return;
      }
      const offset = { x: nextPolygon[0].x - encounter.zones.byId[zoneDrag.zoneId].polygon[0].x,
        y: nextPolygon[0].y - encounter.zones.byId[zoneDrag.zoneId].polygon[0].y };
      if (encounter.movementRules.zoneLocked && !encounter.movementRules.snapToGrid) {
        cacheActorRenderPlacementsForZoneMove(resolved.nextEncounter, sourcePlacements, zoneDrag.zoneId, offset, encounter);
        for (const { actor, point } of input.actorRenderPlacements) {
          if (actor.currentZoneId === zoneDrag.zoneId) {
            setOptimisticActorPlacement(actor.id, { x: point.x + offset.x, y: point.y + offset.y });
          }
        }
      }
      input.dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
      input.dispatch(selectEntity({ entityType: 'zone', ids: [zoneDrag.zoneId] }));
      input.setZoneDrag(null);
    });
    const ready = placements instanceof Promise
      ? Promise.all([prepared, placements])
      : prepared instanceof Promise ? prepared.then(result => [result, placements] as const) : [prepared, placements] as const;
    void consumeEncounterPreparation(ready, ([result, source]) => { apply(result, source); }, () => {
      if (input.zoneGestureRevisionRef.current === revision) input.setZoneDrag(null);
    });
  }

  if (!zoneDrag.hasMoved) input.setZoneDrag(null);
  return true;
}

/** Finalize a zone move or vertex reshape, if one is active. */
export function handleZoneMouseUp(input: MouseUpHandlerInput): boolean {
  return commitZoneMove(input) || commitZoneReshape(input);
}
