import { snapZoneResizePolygon } from '@ui/canvas/zones/snapZoneResizePolygon';
import { getZoneRotationCenter, normalizeRotation, rotatePoint } from '@entities/zone/zoneRotation';
import { isPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { useZoneMoveGesture } from "./useZoneMoveGesture";
import { runEncounterOperation } from "@core/history/encounterOperations";
import { snapZonePolygon, translateSnappedZone } from '@core/movement/zoneVertexSnapping';
import { nearestGridVertex } from '@core/movement/gridTopology';
import { handleSpatialActorMouseUp } from './spatialActorMouseUp';
import type { MouseEvent, PointerEvent } from 'react';
import { useEffect, useRef } from 'react';

import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import { clearSelection, selectEntity } from '@interaction/interactionState';
import type { SelectableEntityType } from '@interaction/selection/types';
import { closeZoneShapeMenu } from '../../toolbar/events';
import type { CanvasInteractionState } from '../canvasInteractionTypes';
import type { ActorDragStartEvent } from '../canvasInteractionTypes';
import { useCanvasMouseUpHandler } from './useCanvasMouseUpHandler';
import { useEngagementHoverIntent } from '../engagements/useEngagementHoverIntent';
import { getPointerTargetZoneId } from '../edges/edgePointerTarget';
import {
  distance,
  getDisplayedZonePolygon,
  resizeZonePolygon,
  toSvgPoint
} from '../zones/zoneGeometry';

type PointerHandlerInput = CanvasInteractionState;

function usesTouchMultiSelect(
  event: Pick<MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>, 'shiftKey' | 'ctrlKey' | 'metaKey'> & {
    pointerType?: string;
  },
  enabled: boolean
): boolean {
  return (
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey ||
    (event.pointerType === 'touch' && enabled)
  );
}

export function useCanvasPointerHandlers(input: PointerHandlerInput) {
  const resizeGestureActive = useRef(false);
  const resizeStartedAt = useRef(0);
  const startZoneMove = useZoneMoveGesture(input);
  const {
    activeToolId,
    actorDrag,
    boxSelection,
    canvasRef,
    dispatch,
    edgeDrag,
    edgeTool,
    encounter,
    selection,
    setActorDrag,
    setBoxSelection,
    setEdgeDrag,
    setShapeDraft,
    setVertexDrag,
    setZoneDraftPoints,
    setZoneDrag,
    shapeDraft,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    suppressNextCanvasClickUnconditionallyRef,
    suppressNextEntityClickRef,
    vertexDrag,
    zoneDrag,
    zonePaintBrush,
    zoneShapeMode,
    touchMultiSelect = false
  } = input;
  const { updateIntent } = useEngagementHoverIntent(
    encounter,
    input.actorRenderPlacements,
    setActorDrag
  );

  useEffect(() => {
    if (activeToolId !== 'zone') {
      setShapeDraft(null);
      setVertexDrag(null);
      setZoneDraftPoints([]);
      setZoneDrag(null);
    }
  }, [
    activeToolId,
    setShapeDraft,
    setVertexDrag,
    setZoneDraftPoints,
    setZoneDrag
  ]);


  useEffect(() => {
    setActorDrag(null); setBoxSelection(null); setEdgeDrag(null); setShapeDraft(null);
    setVertexDrag(null); setZoneDraftPoints([]); setZoneDrag(null);
  }, [encounter.id, encounter.movementRules.zoneLocked]);

  useEffect(() => {
    if (!encounter.movementRules.zoneLocked && actorDrag?.phase === 'dragging') setActorDrag(null);
  }, [encounter]);

  const getDisplayedPolygon = (zone: Zone) => {
    if (zoneDrag?.zoneId === zone.id && zoneDrag.phase === 'dragging') {
      return translateSnappedZone(encounter, { ...zone, polygon: zoneDrag.originalPolygon }, {
        x: zoneDrag.current.x - zoneDrag.start.x, y: zoneDrag.current.y - zoneDrag.start.y
      });
    }
    if (vertexDrag?.zoneId === zone.id && vertexDrag.rotation !== undefined && vertexDrag.phase !== "validating") return vertexDrag.polygon;
    const displayed = { ...zone,
      rotation: vertexDrag?.zoneId === zone.id ? vertexDrag.rotation ?? vertexDrag.editingRotation ?? zone.rotation : zoneDrag?.zoneId === zone.id ? zoneDrag.rotation ?? zone.rotation : zone.rotation,
      polygon: getDisplayedZonePolygon(zone, zoneDrag, vertexDrag) };
    return vertexDrag?.zoneId === zone.id && vertexDrag.rotation === undefined
      ? snapZoneResizePolygon(encounter, displayed, vertexDrag.vertexIndex)
      : snapZonePolygon(encounter, displayed);
  };
  const finishCanvasInteraction = useCanvasMouseUpHandler({
    ...input,
    getDisplayedPolygon
  });

  function handleCanvasMouseMove(
    event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>
  ) {
    if (actorDrag) {
      return;
    }

    if (edgeDrag) {
      const targetZoneId = getPointerTargetZoneId(event);
      setEdgeDrag({
        ...edgeDrag,
        current: toSvgPoint(event, event.currentTarget),
        targetZoneId: targetZoneId !== edgeDrag.sourceZoneId ? targetZoneId : undefined
      });
      return;
    }

    if (shapeDraft) {
      setShapeDraft({
        ...shapeDraft,
        current: encounter.movementRules.snapZoneVertices ? nearestGridVertex(encounter, toSvgPoint(event, event.currentTarget)) : toSvgPoint(event, event.currentTarget)
      });
      return;
    }

    if (boxSelection) {
      setBoxSelection({
        ...boxSelection,
        current: toSvgPoint(event, event.currentTarget)
      });
      return;
    }

    if (zoneDrag) {
      return;
    }

    if (vertexDrag) {
      return;
    }
  }

  function handleCanvasMouseDown(
    event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>
  ) {
    if (zonePaintBrush) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>('[data-entity-id]');
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset.entityType as
      | SelectableEntityType
      | undefined;
    const multiSelect = usesTouchMultiSelect(
      event as (MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) & { pointerType?: string },
      touchMultiSelect
    );
    const pointerType = (event as (MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>) & {
      pointerType?: string;
    }).pointerType;
    const point = toSvgPoint(event, event.currentTarget);

    if (activeToolId === 'edge' && entityType === 'zone' && entityId) {
      event.preventDefault();
      dispatch(clearSelection());
      setEdgeDrag({ current: point, sourceZoneId: entityId, start: point });
      return;
    }

    if (
      !entityId &&
      (event.shiftKey || (pointerType === 'touch' && touchMultiSelect)) &&
      (activeToolId === 'actor' || activeToolId === 'grid' ||
        activeToolId === 'zone' ||
        activeToolId === 'select')
    ) {
      event.preventDefault();
      closeZoneShapeMenu();
      setBoxSelection({
        current: point,
        start: point
      });
      return;
    }

    if (activeToolId !== 'zone') {
      return;
    }

    if (entityType === 'zone' && entityId && encounter.zones.byId[entityId]) {
      closeZoneShapeMenu();
      dispatch(
        selectEntity({
          entityType: 'zone',
          ids: [entityId],
          toggle: multiSelect
        })
      );
      suppressNextCanvasClickRef.current = true;
      suppressNextEntityClickRef.current = entityId;
      if (event.ctrlKey || event.metaKey || (pointerType === 'touch' && touchMultiSelect)) {
        setZoneDraftPoints([]);
        return;
      }
      setZoneDraftPoints([]);
      resizeGestureActive.current = false;
      startZoneMove(entityId, point, entityElement ?? undefined, pointerType);
      return;
    }

    if (!entityId && zoneShapeMode !== 'polygon') {
      event.preventDefault();
      closeZoneShapeMenu();
      const cloneSourceZoneId =
        (event.ctrlKey || event.metaKey) &&
        selection.selectedEntityType === 'zone'
          ? selection.selectedIds[0]
          : undefined;

      dispatch(clearSelection());
      setShapeDraft({
        cloneSourceZoneId,
        current: encounter.movementRules.snapZoneVertices ? nearestGridVertex(encounter, point) : point,
        shape: zoneShapeMode,
        start: encounter.movementRules.snapZoneVertices ? nearestGridVertex(encounter, point) : point
      });
    }
  }

  function handleActorDragStart(
    actorId: string,
    point: LayoutPoint,
    event: ActorDragStartEvent
  ) {
    if (!['actor', 'select', 'grid'].includes(activeToolId)) {
      return;
    }

    closeZoneShapeMenu();
    const multiSelect =
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      Boolean(event.touchMultiSelect);
    const dragActorIds =
      selection.selectedEntityType === 'actor' &&
      selection.selectedIds.includes(actorId) &&
      !multiSelect
        ? selection.selectedIds.filter(id => encounter.movementRules.zoneLocked || input.actorRenderPlacements.some(placement => placement.actor.id === id))
        : [actorId];

    if (
      dragActorIds.length === 1 ||
      multiSelect
    ) {
      dispatch(
        selectEntity({
          entityType: 'actor',
          ids: [actorId],
          userInitiated: true,
          toggle: multiSelect
        })
      );
    }
    suppressNextCanvasClickRef.current = true;
    suppressNextEntityClickRef.current = actorId;
    setActorDrag({
      actorId,
      actorIds: dragActorIds,
      current: point,
      hasMoved: false,
      originPointsByActorId: Object.fromEntries(
        dragActorIds.map((dragActorId) => {
          const placement = input.actorRenderPlacements.find(
            ({ actor }) => actor.id === dragActorId
          );

          return [dragActorId, placement?.point ?? point];
        })
      ),
      phase: 'dragging',
      start: point
    });
  }

  function handleActorDrag(point: LayoutPoint) {
    if (!actorDrag) {
      return;
    }

    const target: { actorId?: string; engagementId?: string } = encounter.movementRules.zoneLocked ? updateIntent(actorDrag, point) : {};
    setActorDrag((drag) => drag ? {
      ...drag,
      current: point,
      engagementIntentActorId:
        target.actorId === drag.engagementIntentActorId
          ? drag.engagementIntentActorId
          : undefined,
      engagementIntentEngagementId:
        target.engagementId === drag.engagementIntentEngagementId
          ? drag.engagementIntentEngagementId
          : undefined,
      hasMoved: drag.hasMoved || distance(drag.start, point) >= 1
    } : null);
  }

  function handleActorDragEnd(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    const pointer = event as { clientX?: number; clientY?: number; target?: EventTarget | null };
    const target = pointer.clientX !== undefined && pointer.clientY !== undefined ? document.elementFromPoint?.(pointer.clientX, pointer.clientY) : null;
    const dropTarget = target ?? (pointer.target instanceof Element ? pointer.target : null);
    if (dropTarget?.closest('[data-drop-target="zoneless-actors"]') && !encounter.movementRules.zoneLocked) {
      handleSpatialActorMouseUp({ ...input, getDisplayedPolygon }, true); return;
    }
    void finishCanvasInteraction();
  }

  function handleCanvasMouseUp(
    event?: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>
  ) {
    if (edgeDrag) {
      const pointerTargetZoneId = event
        ? getPointerTargetZoneId(event)
        : undefined;
      const targetZoneId = pointerTargetZoneId === undefined
        ? edgeDrag.targetZoneId
        : pointerTargetZoneId !== edgeDrag.sourceZoneId
          ? pointerTargetZoneId
          : undefined;
      setEdgeDrag(null);
      if (targetZoneId) {
        void runEncounterOperation(() => import('../edges/edgeCreationActions').then(({ commitEdgeDrag }) =>
          commitEdgeDrag({
            dispatch,
            encounter,
            fromZoneId: edgeDrag.sourceZoneId,
            preset: edgeTool,
            toZoneId: targetZoneId
          })
        ));
      }
      return;
    }
    // A new shape's release must clear its draft even while an earlier Zone
    // edit is settling or waiting for asynchronous validation.
    if (shapeDraft) {
      void finishCanvasInteraction();
      return;
    }
    if (actorDrag?.hasMoved || (zoneDrag?.phase === 'dragging' && zoneDrag.hasMoved) || vertexDrag?.hasMoved) {
      return;
    }

    void finishCanvasInteraction();
  }

  function handleResizeHandleMouseDown(
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement> | PointerEvent<SVGCircleElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (!isPersistenceWritable()) return;
    closeZoneShapeMenu();
    const gestureId = ++input.zoneGestureRevisionRef.current;
    resizeStartedAt.current = event.timeStamp;
    setZoneDrag(null);
    resizeGestureActive.current = true;
    suppressNextCanvasClickRef.current = true;
    setVertexDrag({
      gestureId, phase: "dragging",
      hasMoved: false,
      handleStart: point,
      polygon,
      vertexIndex, editingRotation: zone.rotation,
      ...(vertexIndex === -1 ? { rotation: zone.rotation ?? 0, rotationSource: { polygon, rotation: zone.rotation ?? 0, center: getZoneRotationCenter({ ...zone, polygon }) } } : {}),
      zoneId: zone.id
    });
    return gestureId;
  }

  function handleResizeHandleDrag(offset: LayoutPoint, gestureId?: number, timeStamp?: number) {
    if ((timeStamp !== undefined && timeStamp < resizeStartedAt.current) || !vertexDrag || vertexDrag.phase === "validating" || !resizeGestureActive.current || (gestureId !== undefined && gestureId !== input.zoneGestureRevisionRef.current)) {
      return;
    }

    const zone = encounter.zones.byId[vertexDrag.zoneId];

    if (!zone) {
      setVertexDrag(null);
      return;
    }

    // Motion can deliver a queued drag callback after release or cancellation.
    // It must not recreate a draft that the commit callback has already cleared.
    setVertexDrag(current => {
      if (!current || current.phase === 'validating' || current.handleStart !== vertexDrag.handleStart) return current;
      const hasMoved = current.hasMoved || distance({ x: 0, y: 0 }, offset) >= 1;
      if (current.rotationSource) {
        const { center, polygon: original, rotation: initial } = current.rotationSource;
        const startAngle = Math.atan2(current.handleStart.y - center.y, current.handleStart.x - center.x);
        const end = { x: current.handleStart.x + offset.x, y: current.handleStart.y + offset.y };
        if (distance(end, center) < 1e-6) return current;
        const delta = (Math.atan2(end.y - center.y, end.x - center.x) - startAngle) * 180 / Math.PI;
        return { ...current, hasMoved, rotation: normalizeRotation(initial + delta), polygon: original.map(point => rotatePoint(point, delta, center)) };
      }
      const polygon = resizeZonePolygon(
        { ...zone, rotation: current.editingRotation ?? zone.rotation },
        current.polygon,
        current.vertexIndex,
        {
          x: current.handleStart.x + offset.x,
          y: current.handleStart.y + offset.y
        }
      );
      if (current.hasMoved === hasMoved && polygon.length === current.polygon.length && polygon.every((point, index) =>
        point.x === current.polygon[index].x && point.y === current.polygon[index].y)) return current;
      return { ...current, hasMoved, polygon };
    });
  }

  function handleResizeHandleDragEnd(event: { stopPropagation: () => void; timeStamp?: number }, gestureId?: number) {
    event.stopPropagation();
    if ((event.timeStamp !== undefined && event.timeStamp < resizeStartedAt.current) || !resizeGestureActive.current || (gestureId !== undefined && gestureId !== input.zoneGestureRevisionRef.current)) return;
    resizeGestureActive.current = false;
    void finishCanvasInteraction();
  }

  return {
    getDisplayedPolygon,
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleResizeHandleDrag,
    handleResizeHandleDragEnd,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown,
  };
}
