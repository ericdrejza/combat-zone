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
  canCommitZonePolygon as canCommitZonePolygonForCollection,
  getZoneResizeAnchor,
  getZoneResizeHandles
} from '../zones/zoneGeometry';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import type { MouseUpHandlerInput } from './mouseUpTypes';

const INVALID_POLYGON_MESSAGE =
  'A zone must remain within the canvas and must not overlap another zone.';

function commitZoneMove(input: MouseUpHandlerInput): boolean {
  const { encounter, zoneDrag } = input;
  if (!zoneDrag) return false;
  if (zoneDrag.hasMoved) {
    const nextPolygon = input.getDisplayedPolygon(
      encounter.zones.byId[zoneDrag.zoneId]
    );
    if (nextPolygon.every((point, i) => Math.hypot(point.x - zoneDrag.originalPolygon[i].x, point.y - zoneDrag.originalPolygon[i].y) < 1e-6)) {
      input.setZoneDrag({ ...zoneDrag, phase: 'committed' });
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
    const prepared = prepareValidatedEncounterChangeForRuntime({ currentEncounter: encounter, nextEncounter,
      action: createEncounterActionRecord('zone.move', { polygon: nextPolygon, zoneId: zoneDrag.zoneId }) });
    const apply = (resolved: Awaited<typeof prepared>) => input.dispatch((_dispatch, getState) => {
      if (!isPersistenceWritable() || getState().encounter.present !== encounter || logEncounterValidationBlock(input.dispatch, resolved)) {
        input.setZoneDrag(null);
        return;
      }
      if (encounter.movementRules.zoneLocked && !encounter.movementRules.snapToGrid) cacheActorRenderPlacementsForZoneMove(resolved.nextEncounter, input.actorRenderPlacements, zoneDrag.zoneId,
        { x: nextPolygon[0].x - zoneDrag.originalPolygon[0].x, y: nextPolygon[0].y - zoneDrag.originalPolygon[0].y });
      input.dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
      input.dispatch(selectEntity({ entityType: 'zone', ids: [zoneDrag.zoneId] }));
      // Keep the drop frame until validation supplies the authoritative target.
      input.setZoneDrag({ ...zoneDrag, phase: 'committed' });
    });
    void consumeEncounterPreparation(prepared, apply, () => input.setZoneDrag(null));
  }

  if (!zoneDrag.hasMoved) input.setZoneDrag(null);
  return true;
}

function commitZoneReshape(input: MouseUpHandlerInput): boolean {
  const { encounter, vertexDrag } = input;
  if (!vertexDrag) return false;

  const resizedZone = encounter.zones.byId[vertexDrag.zoneId];
  const resizeHandles = resizedZone
    ? getZoneResizeHandles(resizedZone, vertexDrag.polygon)
    : [];
  input.suppressNextCanvasClickRef.current = true;
  input.suppressNextCanvasClickUnconditionallyRef.current = true;
  input.suppressNextCanvasClickPointRef.current =
    resizeHandles[vertexDrag.vertexIndex] ?? null;

  if (!vertexDrag.hasMoved) {
    input.setVertexDrag(null);
    return true;
  }
  if (
    !canCommitZonePolygonForCollection(
      vertexDrag.polygon,
      encounter.zones,
      vertexDrag.zoneId,
      encounter.canvasSize
    )
  ) {
    logEncounterValidationFailure(input.dispatch, encounter, {
      actionType: 'zone.reshape',
      code: 'zone.invalidPolygonPlacement',
      message: INVALID_POLYGON_MESSAGE,
      payload: { polygon: vertexDrag.polygon, zoneId: vertexDrag.zoneId }
    });
    input.setVertexDrag(null);
    return true;
  }

  const nextEncounter = updateZonePolygon(
    encounter,
    vertexDrag.zoneId,
    vertexDrag.polygon
  );
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord('zone.reshape', {
      polygon: vertexDrag.polygon,
      ...(resizedZone
        ? {
            resizeAnchor: getZoneResizeAnchor(
              resizedZone,
              vertexDrag.polygon,
              vertexDrag.vertexIndex
            )
          }
        : {}),
      zoneId: vertexDrag.zoneId
    }),
    currentEncounter: encounter,
    nextEncounter
  });
  const commitPrepared = (resolved: Awaited<typeof prepared>) => input.dispatch((_dispatch, getState) => {
    if (!isPersistenceWritable() || getState().encounter.present !== encounter) { input.setVertexDrag(null); return; }
    const committedPolygon =
      resolved.nextEncounter.zones.byId[vertexDrag.zoneId]?.polygon ??
      vertexDrag.polygon;
    if (
      resolved.blocked ||
      !canCommitZonePolygonForCollection(
        committedPolygon,
        encounter.zones,
        vertexDrag.zoneId,
        encounter.canvasSize
      )
    ) {
      const pipelineRejected = logEncounterValidationBlock(input.dispatch, resolved);
      if (!pipelineRejected) {
        logEncounterValidationFailure(input.dispatch, encounter, {
          actionType: 'zone.reshape',
          code: 'zone.invalidPolygonPlacement',
          message: INVALID_POLYGON_MESSAGE,
          payload: { polygon: committedPolygon, zoneId: vertexDrag.zoneId }
        });
      }
      input.setVertexDrag(null);
      return;
    }
    input.dispatch(
      commitEncounterChange({
        action: {
          ...resolved.action,
          payload: {
            ...resolved.action.payload,
            polygon: committedPolygon,
            requestedPolygon: vertexDrag.polygon
          }
        },
        nextEncounter: resolved.nextEncounter
      })
    );
    input.dispatch(selectEntity({ entityType: 'zone', ids: [vertexDrag.zoneId] }));
    input.setVertexDrag(null);
  });
  void consumeEncounterPreparation(prepared, commitPrepared, () => input.setVertexDrag(null));
  return true;
}

/** Finalize a zone move or vertex reshape, if one is active. */
export function handleZoneMouseUp(input: MouseUpHandlerInput): boolean {
  return commitZoneMove(input) || commitZoneReshape(input);
}
