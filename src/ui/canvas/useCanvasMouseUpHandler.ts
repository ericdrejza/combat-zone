import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { ZONELESS_ACTOR_ZONE_ID } from "../../core/encounter/types";
import { prepareValidatedEncounterChange } from "../../core/validation/validatedEncounterChange";
import { moveActor } from "../../entities/actor/actorMutations";
import type { Zone } from "../../entities/zone/types";
import { updateZonePolygon } from "../../entities/zone/zoneMutations";
import {
  finishBoxSelection,
  selectEntity
} from "../../interaction/interactionState";
import { commitEncounterChange } from "../../store/encounterSlice";
import { findZoneIdAtPoint } from "./actorCanvasLayout";
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
    actorDrag,
    getDisplayedPolygon,
    setActorDrag,
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
    if (actorDrag) {
      if (actorDrag.hasMoved) {
        const destinationZoneId =
          findZoneIdAtPoint(encounter, actorDrag.current) ?? ZONELESS_ACTOR_ZONE_ID;
        const nextEncounter = moveActor(
          encounter,
          actorDrag.actorId,
          destinationZoneId
        );
        const action = createEncounterActionRecord("actor.move", {
          actorId: actorDrag.actorId,
          destinationZoneId
        });
        const prepared = prepareValidatedEncounterChange({
          action,
          currentEncounter: encounter,
          nextEncounter
        });

        if (!prepared.blocked && nextEncounter !== encounter) {
          dispatch(
            commitEncounterChange({
              action: prepared.action,
              nextEncounter: prepared.nextEncounter
            })
          );
          dispatch(
            selectEntity({
              entityType: "actor",
              ids: [actorDrag.actorId]
            })
          );
        }
      }

      setActorDrag(null);
      return;
    }

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
