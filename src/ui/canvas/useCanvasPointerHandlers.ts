import type { MouseEvent } from "react";
import { useEffect } from "react";

import type { LayoutPoint } from "../../core/layout/types";
import type { Zone } from "../../entities/zone/types";
import {
  clearSelection,
  selectEntity
} from "../../interaction/interactionState";
import type { SelectableEntityType } from "../../interaction/selection/types";
import { closeZoneShapeMenu } from "../toolbar/events";
import type { CanvasInteractionState } from "./canvasInteractionTypes";
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
      (activeToolId === "zone" || activeToolId === "select")
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

  function handleActorMouseDown(
    actorId: string,
    point: LayoutPoint,
    event: MouseEvent<SVGGElement>
  ) {
    if (
      event.button !== 0 ||
      (activeToolId !== "actor" && activeToolId !== "select")
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    closeZoneShapeMenu();
    dispatch(
      selectEntity({
        entityType: "actor",
        ids: [actorId],
        toggle: event.shiftKey || event.ctrlKey || event.metaKey
      })
    );
    suppressNextCanvasClickRef.current = true;
    suppressNextEntityClickRef.current = actorId;
    setActorDrag({
      actorId,
      current: point,
      hasMoved: false,
      start: point
    });
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
    handleActorMouseDown,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  };
}
