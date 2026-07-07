import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import type { Zone } from "../../entities/zone/types";
import { updateZonePolygon } from "../../entities/zone/zoneMutations";
import {
  finishBoxSelection,
  selectEntity
} from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import { MIN_SHAPE_SIZE } from "./canvasConstants";
import type { CanvasInteractionState } from "./canvasInteractionTypes";
import { commitZoneCreate } from "./zoneCreationActions";
import {
  canCommitZonePolygon as canCommitZonePolygonForCollection,
  createShapePolygon,
  distance,
  doBoundsOverlap,
  getBoxSelectionBounds,
  getPolygonBounds,
  getZoneResizeHandles
} from "./zoneGeometry";

type MouseUpHandlerInput = CanvasInteractionState & {
  getDisplayedPolygon: (zone: Zone) => Zone["polygon"];
};

export function useCanvasMouseUpHandler(input: MouseUpHandlerInput) {
  const {
    boxSelection,
    dispatch,
    encounter,
    getDisplayedPolygon,
    setBoxSelection,
    setShapeDraft,
    setVertexDrag,
    setZoneDrag,
    shapeDraft,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    suppressNextCanvasClickUnconditionallyRef,
    vertexDrag,
    zoneDrag
  } = input;

  function handleCanvasMouseUp() {
    if (shapeDraft) {
      const polygon = createShapePolygon(
        shapeDraft.shape,
        shapeDraft.start,
        shapeDraft.current
      );

      if (distance(shapeDraft.start, shapeDraft.current) >= MIN_SHAPE_SIZE) {
        commitZoneCreate(
          input,
          polygon,
          shapeDraft.shape,
          shapeDraft.current,
          shapeDraft.cloneSourceZoneId
        );
      }

      setShapeDraft(null);
      return;
    }

    if (boxSelection) {
      const bounds = getBoxSelectionBounds(boxSelection);
      const selectedZoneIds = encounter.zones.allIds.filter((zoneId) => {
        const zone = encounter.zones.byId[zoneId];

        return zone && doBoundsOverlap(bounds, getPolygonBounds(zone.polygon));
      });

      dispatch(
        finishBoxSelection({
          additive: true,
          entityType: "zone",
          ids: selectedZoneIds
        })
      );
      setBoxSelection(null);
      suppressNextCanvasClickRef.current = true;
      suppressNextCanvasClickUnconditionallyRef.current = true;
      return;
    }

    if (zoneDrag) {
      if (zoneDrag.hasMoved) {
        const nextPolygon = getDisplayedPolygon(
          encounter.zones.byId[zoneDrag.zoneId]
        );

        if (
          !canCommitZonePolygonForCollection(
            nextPolygon,
            encounter.zones,
            zoneDrag.zoneId
          )
        ) {
          setZoneDrag(null);
          return;
        }

        const nextEncounter = updateZonePolygon(
          encounter,
          zoneDrag.zoneId,
          nextPolygon
        );

        dispatch(
          commitEncounterChange({
            action: createEncounterActionRecord("zone.move", {
              polygon: nextPolygon,
              zoneId: zoneDrag.zoneId
            }),
            nextEncounter
          })
        );
        dispatch(
          selectEntity({
            entityType: "zone",
            ids: [zoneDrag.zoneId]
          })
        );
      }

      setZoneDrag(null);
      return;
    }

    if (!vertexDrag) {
      return;
    }

    const resizedZone = encounter.zones.byId[vertexDrag.zoneId];
    const resizeHandles = resizedZone
      ? getZoneResizeHandles(resizedZone, vertexDrag.polygon)
      : [];

    suppressNextCanvasClickRef.current = true;
    suppressNextCanvasClickUnconditionallyRef.current = true;
    suppressNextCanvasClickPointRef.current =
      resizeHandles[vertexDrag.vertexIndex] ?? null;

    if (!vertexDrag.hasMoved) {
      setVertexDrag(null);
      return;
    }

    if (
      !canCommitZonePolygonForCollection(
        vertexDrag.polygon,
        encounter.zones,
        vertexDrag.zoneId
      )
    ) {
      setVertexDrag(null);
      return;
    }

    const nextEncounter = updateZonePolygon(
      encounter,
      vertexDrag.zoneId,
      vertexDrag.polygon
    );

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("zone.reshape", {
          polygon: vertexDrag.polygon,
          zoneId: vertexDrag.zoneId
        }),
        nextEncounter
      })
    );
    dispatch(
      selectEntity({
        entityType: "zone",
        ids: [vertexDrag.zoneId]
      })
    );
    setVertexDrag(null);
  }

  return handleCanvasMouseUp;
}
