import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
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
    cacheActorRenderPlacementsForZoneMove(
      nextEncounter,
      input.actorRenderPlacements,
      zoneDrag.zoneId,
      {
        x: zoneDrag.current.x - zoneDrag.start.x,
        y: zoneDrag.current.y - zoneDrag.start.y
      }
    );
    input.dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord('zone.move', {
          polygon: nextPolygon,
          zoneId: zoneDrag.zoneId
        }),
        nextEncounter
      })
    );
    input.dispatch(selectEntity({ entityType: 'zone', ids: [zoneDrag.zoneId] }));
  }

  input.setZoneDrag(
    zoneDrag.hasMoved ? { ...zoneDrag, phase: 'committed' } : null
  );
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
  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
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
  };
  if (prepared instanceof Promise) void prepared.then(commitPrepared);
  else commitPrepared(prepared);
  return true;
}

/** Finalize a zone move or vertex reshape, if one is active. */
export function handleZoneMouseUp(input: MouseUpHandlerInput): boolean {
  return commitZoneMove(input) || commitZoneReshape(input);
}
