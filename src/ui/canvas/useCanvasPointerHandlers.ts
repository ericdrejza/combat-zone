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
import { findZoneIdAtPoint } from "./zoneHitTesting";

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

  useEffect(() => {
    if (!actorDrag || actorDrag.usesMotion) {
      return;
    }

    function handleWindowMouseMove(event: globalThis.MouseEvent) {
      const svg = canvasRef.current;

      if (!svg) {
        return;
      }

      const current = toSvgPoint(event, svg);

      setActorDrag((drag) =>
        drag
          ? {
              ...drag,
              current,
              hasMoved: drag.hasMoved || distance(drag.start, current) >= 1
            }
          : null
      );
    }

    window.addEventListener("mousemove", handleWindowMouseMove);

    return () => window.removeEventListener("mousemove", handleWindowMouseMove);
  }, [actorDrag, canvasRef, setActorDrag]);

  const getDisplayedPolygon = (zone: Zone) =>
    getDisplayedZonePolygon(zone, zoneDrag, vertexDrag);
  const handleCanvasMouseUp = useCanvasMouseUpHandler({
    ...input,
    getDisplayedPolygon
  });

  function handleCanvasMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (actorDrag) {
      const current = toSvgPoint(event, event.currentTarget);

      setActorDrag({
        ...actorDrag,
        current,
        hasMoved: actorDrag.hasMoved || distance(actorDrag.start, current) >= 1
      });
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
      const current = toSvgPoint(event, event.currentTarget);

      setZoneDrag({
        ...zoneDrag,
        current,
        hasMoved: zoneDrag.hasMoved || distance(zoneDrag.start, current) >= 1
      });
      return;
    }

    if (!vertexDrag) {
      return;
    }

    const point = toSvgPoint(event, event.currentTarget);
    const zone = encounter.zones.byId[vertexDrag.zoneId];

    if (!zone) {
      setVertexDrag(null);
      return;
    }

    const polygon = resizeZonePolygon(
      zone,
      vertexDrag.polygon,
      vertexDrag.vertexIndex,
      point
    );

    setVertexDrag({
      ...vertexDrag,
      hasMoved: vertexDrag.hasMoved || distance(vertexDrag.handleStart, point) >= 1,
      polygon
    });
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
    event: ActorDragStartEvent,
    usesMotion = false
  ) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    if (activeToolId === "zone") {
      const zoneId = findZoneIdAtPoint(encounter, point);
      const zone = zoneId ? encounter.zones.byId[zoneId] : undefined;

      if (!zone) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeZoneShapeMenu();
      dispatch(
        selectEntity({
          entityType: "zone",
          ids: [zone.id],
          toggle: event.shiftKey || event.ctrlKey || event.metaKey
        })
      );
      suppressNextCanvasClickRef.current = true;
      suppressNextCanvasClickUnconditionallyRef.current = true;
      suppressNextEntityClickRef.current = zone.id;

      if (!(event.ctrlKey || event.metaKey)) {
        setZoneDraftPoints([]);
        setZoneDrag({
          current: point,
          hasMoved: false,
          originalPolygon: zone.polygon,
          start: point,
          zoneId: zone.id
        });
      }
      return;
    }

    if (activeToolId !== "actor" && activeToolId !== "select") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
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
      start: point,
      usesMotion
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

  function handleActorDragEnd(event: { stopPropagation: () => void }) {
    event.stopPropagation();
    handleCanvasMouseUp();
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

  return {
    getDisplayedPolygon,
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  };
}
