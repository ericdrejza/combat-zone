import type { MouseEvent } from "react";
import { useEffect } from "react";

import type { LayoutPoint } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import {
  clearSelection,
  selectEntity
} from "@interaction/interactionState";
import type { SelectableEntityType } from "@interaction/selection/types";
import { closeZoneShapeMenu } from "../toolbar/events";
import type { CanvasInteractionState } from "./canvasInteractionTypes";
import type { ActorDragStartEvent } from "./canvasInteractionTypes";
import { useCanvasMouseUpHandler } from "./useCanvasMouseUpHandler";
import {
  distance,
  getDisplayedZonePolygon,
  resizeZonePolygon,
  toSvgPoint
} from "./zoneGeometry";

type PointerHandlerInput = CanvasInteractionState;

export function useCanvasPointerHandlers(input: PointerHandlerInput) {
  const {
    activeToolId,
    actorDrag,
    boxSelection,
    canvasRef,
    dispatch,
    encounter,
    selection,
    setActorDrag,
    setBoxSelection,
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
    zoneShapeMode
  } = input;

  useEffect(() => {
    if (activeToolId !== "zone") {
      setShapeDraft(null);
      setVertexDrag(null);
      setZoneDraftPoints([]);
      setZoneDrag(null);
    }
  }, [activeToolId, setShapeDraft, setVertexDrag, setZoneDraftPoints, setZoneDrag]);

  const getDisplayedPolygon = (zone: Zone) =>
    getDisplayedZonePolygon(zone, zoneDrag, vertexDrag);
  const finishCanvasInteraction = useCanvasMouseUpHandler({
    ...input,
    getDisplayedPolygon
  });

  function handleCanvasMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (actorDrag) {
      return;
    }

    if (shapeDraft) {
      setShapeDraft({
        ...shapeDraft,
        current: toSvgPoint(event, event.currentTarget)
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

  function handleCanvasMouseDown(event: MouseEvent<SVGSVGElement>) {
    if (zonePaintBrush) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const target = event.target as Element;
    const entityElement = target.closest<SVGElement>("[data-entity-id]");
    const entityId = entityElement?.dataset.entityId;
    const entityType = entityElement?.dataset
      .entityType as SelectableEntityType | undefined;
    const point = toSvgPoint(event, event.currentTarget);

    if (
      !entityId &&
      event.shiftKey &&
      (activeToolId === "actor" ||
        activeToolId === "zone" ||
        activeToolId === "select")
    ) {
      event.preventDefault();
      closeZoneShapeMenu();
      setBoxSelection({
        current: point,
        start: point
      });
      return;
    }

    if (activeToolId !== "zone") {
      return;
    }

    if (entityType === "zone" && entityId && encounter.zones.byId[entityId]) {
      closeZoneShapeMenu();
      dispatch(
        selectEntity({
          entityType: "zone",
          ids: [entityId],
          toggle: event.shiftKey || event.ctrlKey || event.metaKey
        })
      );
      suppressNextCanvasClickRef.current = true;
      suppressNextEntityClickRef.current = entityId;
      if (event.ctrlKey || event.metaKey) {
        setZoneDraftPoints([]);
        return;
      }
      setZoneDraftPoints([]);
      setZoneDrag({
        current: point,
        hasMoved: false,
        originalPolygon: encounter.zones.byId[entityId].polygon,
        phase: "dragging",
        start: point,
        zoneId: entityId
      });
      return;
    }

    if (!entityId && zoneShapeMode !== "polygon") {
      event.preventDefault();
      closeZoneShapeMenu();
      const cloneSourceZoneId =
        (event.ctrlKey || event.metaKey) &&
        selection.selectedEntityType === "zone"
          ? selection.selectedIds[0]
          : undefined;

      dispatch(clearSelection());
      setShapeDraft({
        cloneSourceZoneId,
        current: point,
        shape: zoneShapeMode,
        start: point
      });
    }
  }

  function handleActorDragStart(
    actorId: string,
    point: LayoutPoint,
    event: ActorDragStartEvent
  ) {
    if (activeToolId !== "actor" && activeToolId !== "select") {
      return;
    }

    closeZoneShapeMenu();
    const dragActorIds =
      selection.selectedEntityType === "actor" &&
      selection.selectedIds.includes(actorId) &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey
        ? selection.selectedIds
        : [actorId];

    if (
      dragActorIds.length === 1 ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      dispatch(
        selectEntity({
          entityType: "actor",
          ids: [actorId],
          toggle: event.shiftKey || event.ctrlKey || event.metaKey
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
      phase: "dragging",
      start: point,
    });
  }

  function handleActorDrag(point: LayoutPoint) {
    if (!actorDrag) {
      return;
    }

    setActorDrag((drag) =>
      drag
        ? {
            ...drag,
            current: point,
            hasMoved: drag.hasMoved || distance(drag.start, point) >= 1
          }
        : null
    );
  }

  function handleZoneDrag(offset: LayoutPoint) {
    setZoneDrag((drag) =>
      drag?.phase === "dragging"
        ? {
            ...drag,
            current: {
              x: drag.start.x + offset.x,
              y: drag.start.y + offset.y
            },
            hasMoved: drag.hasMoved || distance({ x: 0, y: 0 }, offset) >= 1
          }
        : drag
    );
  }

  function handleZoneDragEnd(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    finishCanvasInteraction();
  }

  function handleActorDragEnd(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    finishCanvasInteraction();
  }

  function handleCanvasMouseUp() {
    if (actorDrag?.hasMoved || zoneDrag?.hasMoved || vertexDrag?.hasMoved) {
      return;
    }

    finishCanvasInteraction();
  }

  function handleResizeHandleMouseDown(
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    closeZoneShapeMenu();
    suppressNextCanvasClickRef.current = true;
    setVertexDrag({
      hasMoved: false,
      handleStart: point,
      polygon,
      vertexIndex,
      zoneId: zone.id
    });
  }

  function handleResizeHandleDrag(offset: LayoutPoint) {
    if (!vertexDrag) {
      return;
    }

    const zone = encounter.zones.byId[vertexDrag.zoneId];

    if (!zone) {
      setVertexDrag(null);
      return;
    }

    setVertexDrag({
      ...vertexDrag,
      hasMoved:
        vertexDrag.hasMoved ||
        distance({ x: 0, y: 0 }, offset) >= 1,
      polygon: resizeZonePolygon(
        zone,
        vertexDrag.polygon,
        vertexDrag.vertexIndex,
        {
          x: vertexDrag.handleStart.x + offset.x,
          y: vertexDrag.handleStart.y + offset.y
        }
      )
    });
  }

  function handleResizeHandleDragEnd(event: {
    stopPropagation: () => void;
  }) {
    event.stopPropagation();
    finishCanvasInteraction();
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
    handleZoneDrag,
    handleZoneDragEnd
  };
}
