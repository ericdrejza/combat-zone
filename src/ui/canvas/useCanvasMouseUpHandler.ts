import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import { moveActor } from "@entities/actor/actorMutations";
import type { Zone } from "@entities/zone/types";
import { updateZonePolygon } from "@entities/zone/zoneMutations";
import {
  finishBoxSelection,
  selectEntity
} from "@interaction/interactionState";
import { commitEncounterChange } from "@store/encounterSlice";
import {
  findZoneIdAtPoint,
  getActorRenderPlacements
} from "./actorCanvasLayout";
import { cacheActorRenderPlacementsForZoneMove } from "./actorPlacementTranslation";
import { setOptimisticActorPlacement } from "./actorPlacementOptimisticState";
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
        const changesZone = actorDrag.actorIds.some(
          (actorId) =>
            encounter.actors.byId[actorId]?.currentZoneId !== destinationZoneId
        );

        // Picking an actor up and dropping it back into its current zone does
        // not change encounter state. Skip mutation construction and
        // validation so the existing geometry remains authoritative.
        if (!changesZone) {
          setActorDrag(null);
          return;
        }

        const nextEncounter = actorDrag.actorIds.reduce(
          (currentEncounter, actorId) =>
            moveActor(currentEncounter, actorId, destinationZoneId),
          encounter
        );
        const action = createEncounterActionRecord(
          actorDrag.actorIds.length > 1 ? "actor.moveMany" : "actor.move",
          {
            actorIds: actorDrag.actorIds,
            destinationZoneId
          }
        );
        const prepared = prepareValidatedEncounterChange({
          action,
          currentEncounter: encounter,
          nextEncounter
        });

        if (!prepared.blocked && nextEncounter !== encounter) {
          if (destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
            const offset = {
              x: actorDrag.current.x - actorDrag.start.x,
              y: actorDrag.current.y - actorDrag.start.y
            };

            input.actorRenderPlacements
              .filter(({ actor }) => actorDrag.actorIds.includes(actor.id))
              .forEach(({ actor, point }) => {
                setOptimisticActorPlacement(actor.id, {
                  x: point.x + offset.x,
                  y: point.y + offset.y
                });
              });
          }

          dispatch(
            commitEncounterChange({
              action: prepared.action,
              nextEncounter: prepared.nextEncounter
            })
          );
          dispatch(
            selectEntity({
              entityType: "actor",
              ids: actorDrag.actorIds
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
      const isActorBoxSelection = input.activeToolId === "actor";
      const selectedIds = isActorBoxSelection
        ? getActorRenderPlacements(encounter)
            .filter(({ point, radius }) =>
              doBoundsOverlap(bounds, {
                height: radius * 2,
                width: radius * 2,
                x: point.x - radius,
                y: point.y - radius
              })
            )
            .map(({ actor }) => actor.id)
        : encounter.zones.allIds.filter((zoneId) => {
            const zone = encounter.zones.byId[zoneId];

            return zone && doBoundsOverlap(bounds, getPolygonBounds(zone.polygon));
          });

      dispatch(
        finishBoxSelection({
          additive: true,
          entityType: isActorBoxSelection ? "actor" : "zone",
          ids: selectedIds
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
        cacheActorRenderPlacementsForZoneMove(
          nextEncounter,
          input.actorRenderPlacements,
          zoneDrag.zoneId,
          {
            x: zoneDrag.current.x - zoneDrag.start.x,
            y: zoneDrag.current.y - zoneDrag.start.y
          }
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
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord("zone.reshape", {
        polygon: vertexDrag.polygon,
        zoneId: vertexDrag.zoneId
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    const committedPolygon =
      prepared.nextEncounter.zones.byId[vertexDrag.zoneId]?.polygon ??
      vertexDrag.polygon;

    if (
      prepared.blocked ||
      !canCommitZonePolygonForCollection(
        committedPolygon,
        encounter.zones,
        vertexDrag.zoneId
      )
    ) {
      setVertexDrag(null);
      return;
    }

    dispatch(
      commitEncounterChange({
        action: {
          ...prepared.action,
          payload: {
            ...prepared.action.payload,
            polygon: committedPolygon,
            requestedPolygon: vertexDrag.polygon
          }
        },
        nextEncounter: prepared.nextEncounter
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
