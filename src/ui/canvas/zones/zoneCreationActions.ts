import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { LayoutPoint } from '@core/layout/types';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import type { ZoneShape } from '@entities/zone/types';
import { createZone } from '@entities/zone/zoneMutations';
import { selectEntity } from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import {
  logEncounterValidationBlock,
  logEncounterValidationFailure
} from '@store/encounterLogSlice';
import type { CanvasInteractionState } from '../canvasInteractionTypes';
import { canCommitZonePolygon as canCommitZonePolygonForCollection } from './zoneGeometry';
import { getCloneableZoneProperties } from './zonePropertyTransfers';

type CommitZoneCreateInput = Pick<
  CanvasInteractionState,
  | 'dispatch'
  | 'encounter'
  | 'lastZoneOpacity'
  | 'setZoneDraftPoints'
  | 'suppressNextCanvasClickPointRef'
  | 'suppressNextCanvasClickRef'
>;

export function commitZoneCreate(
  input: CommitZoneCreateInput,
  polygon: LayoutPoint[],
  shape: ZoneShape,
  suppressClickPoint?: LayoutPoint,
  cloneSourceZoneId?: string
): void {
  const {
    dispatch,
    encounter,
    lastZoneOpacity,
    setZoneDraftPoints,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef
  } = input;

  if (!canCommitZonePolygonForCollection(polygon, encounter.zones)) {
    logEncounterValidationFailure(dispatch, encounter, {
      actionType: 'zone.create',
      code: 'zone.invalidPolygonPlacement',
      message: 'A zone must remain within the canvas and must not overlap another zone.',
      payload: { polygon, shape }
    });
    setZoneDraftPoints([]);
    return;
  }

  const zoneId = `zone-${Date.now()}`;
  const cloneSourceZone = cloneSourceZoneId
    ? encounter.zones.byId[cloneSourceZoneId]
    : undefined;
  const nextEncounter = createZone(encounter, {
    ...(cloneSourceZone ? getCloneableZoneProperties(cloneSourceZone) : {}),
    id: zoneId,
    name: `Zone ${encounter.zones.allIds.length + 1}`,
    opacity: cloneSourceZone ? cloneSourceZone.opacity : lastZoneOpacity,
    polygon,
    shape
  });

  const prepared = prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord('zone.create', {
      ...(cloneSourceZoneId ? { cloneSourceZoneId } : {}),
      zoneId,
      polygon,
      shape
    }),
    currentEncounter: encounter,
    nextEncounter
  });

  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
    if (resolved.blocked) {
      logEncounterValidationBlock(dispatch, resolved);
      setZoneDraftPoints([]);
      return;
    }

    dispatch(
      commitEncounterChange({
        action: resolved.action,
        nextEncounter: resolved.nextEncounter
      })
    );
    dispatch(
      selectEntity({
        entityType: 'zone',
        ids: [zoneId]
      })
    );
    suppressNextCanvasClickRef.current = true;
    suppressNextCanvasClickPointRef.current =
      suppressClickPoint ?? polygon[polygon.length - 1] ?? null;
    setZoneDraftPoints([]);
  };

  if (prepared instanceof Promise) {
    void prepared.then(commitPrepared);
  } else {
    commitPrepared(prepared);
  }
}
