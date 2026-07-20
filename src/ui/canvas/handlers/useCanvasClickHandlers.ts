import type { MouseEvent } from 'react';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import {
  clearActorPaintBrush,
  clearSelection,
  clearZonePaintBrush,
  selectEntity,
  setActorToolTargetZone,
  setLastZoneOpacity
} from '@interaction/interactionState';
import type { SelectableEntityType } from '@interaction/selection/types';
import { commitEncounterChange } from '@store/encounterSlice';
import { closeZoneShapeMenu } from '../../toolbar/events';
import { CLOSE_DISTANCE } from '../canvasConstants';
import type { CanvasInteractionState } from '../canvasInteractionTypes';
import { commitZoneCreate } from '../zones/zoneCreationActions';
import {
  canCommitZonePolygon as canCommitZonePolygonForCollection,
  distance,
  doesZoneOverlapExisting as doesZoneOverlapExistingInCollection,
  isPointWithinCanvas,
  isPolygonWithinCanvas,
  toSvgPoint
} from '../zones/zoneGeometry';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import { getPaintableZoneProperties } from '../zones/zonePropertyTransfers';

type ClickHandlerInput = Pick<
  CanvasInteractionState,
  | 'activeToolId'
  | 'actorPaintBrush'
  | 'actorTool'
  | 'boxSelection'
  | 'dispatch'
  | 'encounter'
  | 'lastZoneOpacity'
  | 'selection'
  | 'setZoneDraftPoints'
  | 'shapeDraft'
  | 'suppressNextCanvasClickPointRef'
  | 'suppressNextCanvasClickRef'
  | 'suppressNextCanvasClickUnconditionallyRef'
  | 'suppressNextEntityClickRef'
  | 'vertexDrag'
  | 'zoneDraftPoints'
  | 'zoneDrag'
  | 'zonePaintBrush'
  | 'zoneShapeMode'
>;

export function useCanvasClickHandlers(input: ClickHandlerInput) {
  const {
    activeToolId,
    actorPaintBrush,
    actorTool,
    boxSelection,
    dispatch,
    encounter,
    selection,
    setZoneDraftPoints,
    shapeDraft,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    suppressNextCanvasClickUnconditionallyRef,
    suppressNextEntityClickRef,
    vertexDrag,
    zoneDraftPoints,
    zoneDrag,
    zonePaintBrush,
    zoneShapeMode
  } = input;

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>('[data-entity-id]');
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset.entityType as
      | SelectableEntityType
      | undefined;

    if (suppressNextEntityClickRef.current === entityId) {
      suppressNextEntityClickRef.current = null;
      suppressNextCanvasClickRef.current = false;
      suppressNextCanvasClickUnconditionallyRef.current = false;
      suppressNextCanvasClickPointRef.current = null;
      return;
    }

    if (suppressNextCanvasClickRef.current) {
      suppressNextCanvasClickRef.current = false;
      const suppressUnconditionally =
        suppressNextCanvasClickUnconditionallyRef.current;
      suppressNextCanvasClickUnconditionallyRef.current = false;
      const suppressedPoint = suppressNextCanvasClickPointRef.current;
      suppressNextCanvasClickPointRef.current = null;

      if (
        suppressUnconditionally ||
        (!entityId &&
          suppressedPoint &&
          distance(toSvgPoint(event, event.currentTarget), suppressedPoint) <=
            1)
      ) {
        return;
      }
    }

    if (
      event.detail > 1 ||
      vertexDrag ||
      zoneDrag ||
      shapeDraft ||
      boxSelection
    ) {
      return;
    }

    if (zonePaintBrush) {
      if (!entityId || entityType !== 'zone') {
        return;
      }

      const sourceZone = encounter.zones.byId[zonePaintBrush.sourceZoneId];

      if (!sourceZone) {
        dispatch(clearZonePaintBrush());
        return;
      }

      const paintProperties = getPaintableZoneProperties(sourceZone);
      const nextEncounter = updateZoneProperties(
        encounter,
        entityId,
        paintProperties
      );

      if (nextEncounter !== encounter) {
        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord('zone.paintColors', {
              properties: paintProperties,
              sourceZoneId: sourceZone.id,
              zoneId: entityId
            }),
            nextEncounter
          })
        );
        dispatch(setLastZoneOpacity(sourceZone.opacity));
      }
      return;
    }

    if (!entityId && (event.shiftKey || event.ctrlKey || event.metaKey)) {
      return;
    }

    if (activeToolId === 'actor') {
      if (entityType === 'zone' && entityId && encounter.zones.byId[entityId]) {
        dispatch(setActorToolTargetZone(entityId));
        return;
      }

      if (!entityId) {
        dispatch(setActorToolTargetZone(null));
        dispatch(clearSelection());
        return;
      }
    }

    if (!entityId && activeToolId === 'zone' && zoneShapeMode === 'polygon') {
      dispatch(clearSelection());
      closeZoneShapeMenu();
      const nextPoint = toSvgPoint(event, event.currentTarget);

      if (!isPointWithinCanvas(nextPoint)) {
        return;
      }

      const startPoint = zoneDraftPoints[0];

      if (
        startPoint &&
        zoneDraftPoints.length >= 3 &&
        distance(startPoint, nextPoint) <= CLOSE_DISTANCE
      ) {
        void commitZoneCreate(input, zoneDraftPoints, 'polygon');
        return;
      }

      const nextPoints = [...zoneDraftPoints, nextPoint];

      if (
        (nextPoints.length >= 3 && !isPolygonWithinCanvas(nextPoints)) ||
        doesZoneOverlapExistingInCollection(nextPoints, encounter.zones)
      ) {
        return;
      }

      setZoneDraftPoints(nextPoints);
      return;
    }

    if (!entityId || !entityType) {
      dispatch(clearSelection());
      return;
    }

    dispatch(
      selectEntity({
        entityType,
        ids: [entityId],
        toggle: event.shiftKey || event.ctrlKey || event.metaKey
      })
    );
  }

  function handleCanvasDoubleClick(event: MouseEvent<SVGSVGElement>) {
    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>('[data-entity-id]');
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset.entityType as
      | SelectableEntityType
      | undefined;

    if (
      (activeToolId === 'actor' || activeToolId === 'select') &&
      entityType === 'zone' &&
      entityId &&
      encounter.zones.byId[entityId]
    ) {
      const actorIds = encounter.actors.allIds.filter(
        (actorId) => encounter.actors.byId[actorId]?.currentZoneId === entityId
      );

      dispatch(
        selectEntity({
          entityType: 'actor',
          ids: actorIds
        })
      );
      return;
    }

    if (activeToolId !== 'zone' || vertexDrag || zoneShapeMode !== 'polygon') {
      return;
    }

    const point = toSvgPoint(event, event.currentTarget);
    const polygon = [...zoneDraftPoints, point];

    if (
      polygon.length >= 3 &&
      canCommitZonePolygonForCollection(polygon, encounter.zones)
    ) {
        void commitZoneCreate(input, polygon, 'polygon');
    }
  }

  function handleCanvasContextMenu(event: MouseEvent<SVGSVGElement>) {
    if (activeToolId === 'actor' && actorTool.targetZoneId) {
      event.preventDefault();
      dispatch(setActorToolTargetZone(null));
      return;
    }

    if (zonePaintBrush) {
      event.preventDefault();
      dispatch(clearZonePaintBrush());
      return;
    }

    if (actorPaintBrush) {
      event.preventDefault();
      dispatch(clearActorPaintBrush());
      return;
    }

    if (
      activeToolId === 'zone' &&
      zoneShapeMode === 'polygon' &&
      zoneDraftPoints.length > 0
    ) {
      event.preventDefault();
      setZoneDraftPoints((points) => points.slice(0, -1));
    }
  }

  return {
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick
  };
}
