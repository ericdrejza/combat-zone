import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { LayoutPoint } from '@core/layout/types';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import type { ZoneShape } from '@entities/zone/types';
import { DEFAULT_ZONE_PALETTE_COLOR } from '@entities/zone/zoneColors';
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
  | 'setZoneDraftPoints'
  | 'suppressNextCanvasClickPointRef'
  | 'suppressNextCanvasClickRef'
  | 'zoneColorDefaults'
  | 'zoneOpacityDefault'
  | 'zoneShowBorderDefault'
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
    setZoneDraftPoints,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    zoneColorDefaults,
    zoneOpacityDefault,
    zoneShowBorderDefault
  } = input;

  if (
    !canCommitZonePolygonForCollection(
      polygon,
      encounter.zones,
      undefined,
      encounter.canvasSize
    )
  ) {
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
  const defaultColors = {
    colorBorder: zoneColorDefaults.border ?? DEFAULT_ZONE_PALETTE_COLOR,
    colorEngagement:
      zoneColorDefaults.engagement ??
      zoneColorDefaults.border ??
      DEFAULT_ZONE_PALETTE_COLOR,
    colorFill: zoneColorDefaults.zone ?? DEFAULT_ZONE_PALETTE_COLOR,
    matchEngagementColorToBorder: zoneColorDefaults.engagement === null
  };
  const nextEncounter = createZone(encounter, {
    ...(cloneSourceZone
      ? getCloneableZoneProperties(cloneSourceZone)
      : defaultColors),
    id: zoneId,
    name: `Zone ${encounter.zones.allIds.length + 1}`,
    opacity: cloneSourceZone ? cloneSourceZone.opacity : zoneOpacityDefault,
    polygon,
    showBorder: cloneSourceZone
      ? cloneSourceZone.showBorder
      : zoneShowBorderDefault,
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
