import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { moveActor } from '@entities/actor/actorMutations';
import {
  createEngagement,
  joinEngagement,
  leaveEngagements,
  moveActorsPreservingCompleteEngagements
} from '@entities/engagement/engagementMutations';
import { isSameEngagementDrop } from '@entities/engagement/engagementDrop';
import type { Zone } from '@entities/zone/types';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import {
  finishBoxSelection,
  selectEntity
} from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import {
  logEncounterValidationBlock,
  logEncounterValidationFailure
} from '@store/encounterLogSlice';
import {
  findZoneIdAtPoint,
  getActorRenderPlacements
} from '../actors/actorCanvasLayout';
import { cacheActorRenderPlacementsForZoneMove } from '../actors/actorPlacementTranslation';
import { setOptimisticActorPlacement } from '../actors/actorPlacementOptimisticState';
import {
  findActorIdAtPoint,
  findEngagementIdAtPoint
} from '../engagements/engagementHitTesting';
import { isWithinEngagementTether } from '../engagements/engagementDragRules';
import { getActorEngagement } from '@core/encounter/inspectors';
import { MIN_SHAPE_SIZE } from '../canvasConstants';
import type {
  ActorDragState,
  CanvasInteractionState
} from '../canvasInteractionTypes';
import { commitZoneCreate } from '../zones/zoneCreationActions';
import {
  canCommitZonePolygon as canCommitZonePolygonForCollection,
  createShapePolygon,
  distance,
  doBoundsOverlap,
  getBoxSelectionBounds,
  getPolygonBounds,
  getZoneResizeAnchor,
  getZoneResizeHandles
} from '../zones/zoneGeometry';

type MouseUpHandlerInput = CanvasInteractionState & {
  getDisplayedPolygon: (zone: Zone) => Zone['polygon'];
};

function createSnapBackDrag(actorDrag: ActorDragState): ActorDragState {
  return {
    ...actorDrag,
    phase: 'returning',
    returnPointsByActorId: actorDrag.originPointsByActorId ?? {
      [actorDrag.actorId]: actorDrag.start
    }
  };
}

function cacheActorDropPoints(
  actorDrag: ActorDragState,
  placements: CanvasInteractionState['actorRenderPlacements']
): void {
  const offset = {
    x: actorDrag.current.x - actorDrag.start.x,
    y: actorDrag.current.y - actorDrag.start.y
  };

  placements
    .filter(({ actor }) => actorDrag.actorIds.includes(actor.id))
    .forEach(({ actor, point }) => {
      const origin = actorDrag.originPointsByActorId?.[actor.id] ?? point;

      setOptimisticActorPlacement(actor.id, {
        x: origin.x + offset.x,
        y: origin.y + offset.y
      });
    });
}

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
        const draggedActorEngagement = getActorEngagement(
          encounter,
          actorDrag.actorId
        );
        if (
          draggedActorEngagement &&
          isWithinEngagementTether(actorDrag.start, actorDrag.current)
        ) {
          setActorDrag(createSnapBackDrag(actorDrag));
          return;
        }
        const targetEngagementId = findEngagementIdAtPoint(
          encounter,
          input.actorRenderPlacements,
          actorDrag.current
        );
        const targetActorId = findActorIdAtPoint(
          input.actorRenderPlacements,
          actorDrag.current,
          actorDrag.actorIds
        );
        const targetActorEngagement = targetActorId
          ? getActorEngagement(encounter, targetActorId)
          : undefined;
        const targetGroupId = targetEngagementId ?? targetActorEngagement?.id;
        const isSameGroupDrop = isSameEngagementDrop(encounter, actorDrag.actorIds, targetGroupId);
        if (isSameGroupDrop) {
          setActorDrag(createSnapBackDrag(actorDrag));
          return;
        }
        let engagementActionType: string | undefined;
        let nextFromEngagement: typeof encounter | undefined;

        if (
          targetGroupId &&
          actorDrag.engagementIntentEngagementId === targetGroupId
        ) {
          nextFromEngagement = joinEngagement(
            encounter,
            targetGroupId,
            actorDrag.actorIds
          );
          engagementActionType = 'engagement.join';
        } else if (targetGroupId) {
          const parentZoneId =
            encounter.engagements.byId[targetGroupId]?.parentZoneId;
          if (parentZoneId) {
            nextFromEngagement = moveActorsPreservingCompleteEngagements(
              encounter,
              actorDrag.actorIds,
              parentZoneId
            );
            engagementActionType = 'actor.moveMany';
          }
        } else if (
          targetActorId &&
          actorDrag.engagementIntentActorId === targetActorId
        ) {
          const parentZoneId =
            encounter.actors.byId[targetActorId]?.currentZoneId;
          if (parentZoneId && parentZoneId !== ZONELESS_ACTOR_ZONE_ID) {
            nextFromEngagement = createEngagement(encounter, {
              id: `engagement-${Date.now()}`,
              parentZoneId,
              participantIds: [...actorDrag.actorIds, targetActorId]
            });
            engagementActionType = 'engagement.create';
          }
        } else if (targetActorId) {
          // A quick actor drop has ordinary move semantics: place the dragged
          // actors in the target zone without creating or joining a group.
          const parentZoneId =
            encounter.actors.byId[targetActorId]?.currentZoneId;
          if (parentZoneId) {
            nextFromEngagement = moveActorsPreservingCompleteEngagements(
              encounter,
              actorDrag.actorIds,
              parentZoneId
            );
            engagementActionType = 'actor.moveMany';
          }
        }
        if (nextFromEngagement && nextFromEngagement !== encounter) {
          const action = createEncounterActionRecord(engagementActionType!, {
            actorIds: actorDrag.actorIds,
            participantIds: targetActorId ? [...actorDrag.actorIds, targetActorId] : actorDrag.actorIds,
            ...(targetGroupId ? { parentZoneId: encounter.engagements.byId[targetGroupId]?.parentZoneId } : {}),
            ...(targetActorId ? { targetActorId } : {}),
            ...(targetGroupId ? { targetEngagementId: targetGroupId } : {})
          });
          const prepared = prepareValidatedEncounterChangeForRuntime({ action, currentEncounter: encounter, nextEncounter: nextFromEngagement });
          const commitPreparedEngagement = (resolved: Awaited<typeof prepared>) => {
            if (!resolved.blocked) {
              cacheActorDropPoints(actorDrag, input.actorRenderPlacements);
              dispatch(commitEncounterChange({ action: resolved.action, nextEncounter: resolved.nextEncounter }));
              dispatch(selectEntity({ entityType: 'actor', ids: actorDrag.actorIds }));
              setActorDrag({
                ...actorDrag,
                phase: 'returning',
                returnPointsByActorId: undefined
              });
              return;
            }
            logEncounterValidationBlock(dispatch, resolved);
            setActorDrag(createSnapBackDrag(actorDrag));
          };
          if (prepared instanceof Promise) void prepared.then(commitPreparedEngagement); else commitPreparedEngagement(prepared);
          return;
        }
        const destinationZoneId =
          findZoneIdAtPoint(encounter, actorDrag.current) ??
          ZONELESS_ACTOR_ZONE_ID;
        const changesZone = actorDrag.actorIds.some(
          (actorId) =>
            encounter.actors.byId[actorId]?.currentZoneId !== destinationZoneId
        );

        // Picking an actor up and dropping it back into its current zone does
        // not change encounter state. Skip mutation construction and
        // validation so the existing geometry remains authoritative.
        const leavesEngagement = actorDrag.actorIds.some((actorId) => Boolean(getActorEngagement(encounter, actorId)));
        if (!changesZone && !leavesEngagement) {
          setActorDrag(createSnapBackDrag(actorDrag));
          return;
        }

        const completeDraggedEngagementIds =
          destinationZoneId !== ZONELESS_ACTOR_ZONE_ID
            ? encounter.engagements.allIds.filter((engagementId) => {
                const engagement = encounter.engagements.byId[engagementId];
                return engagement?.participantIds.every((actorId) =>
                  actorDrag.actorIds.includes(actorId)
                );
              })
            : [];
        let nextEncounter =
          destinationZoneId !== ZONELESS_ACTOR_ZONE_ID
            ? moveActorsPreservingCompleteEngagements(
                encounter,
                actorDrag.actorIds,
                destinationZoneId
              )
            : actorDrag.actorIds.reduce(
                (currentEncounter, actorId) =>
                  moveActor(currentEncounter, actorId, destinationZoneId),
                encounter
              );
        if (destinationZoneId === ZONELESS_ACTOR_ZONE_ID) {
          nextEncounter = leaveEngagements(
            nextEncounter,
            actorDrag.actorIds
          );
        }
        const action = createEncounterActionRecord(
          completeDraggedEngagementIds.length > 0
            ? 'engagement.moveZone'
            : actorDrag.actorIds.length > 1
              ? 'actor.moveMany'
              : 'actor.move',
          {
            actorIds: actorDrag.actorIds,
            destinationZoneId,
            ...(completeDraggedEngagementIds.length > 0
              ? { engagementIds: completeDraggedEngagementIds }
              : {})
          }
        );
        const prepared = prepareValidatedEncounterChangeForRuntime({
          action,
          currentEncounter: encounter,
          nextEncounter
        });

        const commitPrepared = (resolved: Awaited<typeof prepared>) => {
          if (!resolved.blocked && nextEncounter !== encounter) {
            if (destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
              cacheActorDropPoints(actorDrag, input.actorRenderPlacements);
            }

            dispatch(
              commitEncounterChange({
                action: resolved.action,
                nextEncounter: resolved.nextEncounter
              })
            );
            dispatch(
              selectEntity({
                entityType: 'actor',
                ids: actorDrag.actorIds
              })
            );
            setActorDrag(
              destinationZoneId === ZONELESS_ACTOR_ZONE_ID
                ? null
                : {
                    ...actorDrag,
                    phase: 'returning',
                    returnPointsByActorId: undefined
                  }
            );
            return;
          }

          logEncounterValidationBlock(dispatch, resolved);

          setActorDrag(createSnapBackDrag(actorDrag));
        };

        if (prepared instanceof Promise) {
          void prepared.then(commitPrepared);
        } else {
          commitPrepared(prepared);
        }
        return;
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
      const isActorBoxSelection = input.activeToolId === 'actor';
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

            return (
              zone && doBoundsOverlap(bounds, getPolygonBounds(zone.polygon))
            );
          });

      dispatch(
        finishBoxSelection({
          additive: true,
          entityType: isActorBoxSelection ? 'actor' : 'zone',
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
            zoneDrag.zoneId,
            encounter.canvasSize
          )
        ) {
          logEncounterValidationFailure(dispatch, encounter, {
            actionType: 'zone.move',
            code: 'zone.invalidPolygonPlacement',
            message: 'A zone must remain within the canvas and must not overlap another zone.',
            payload: { polygon: nextPolygon, zoneId: zoneDrag.zoneId }
          });
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
            action: createEncounterActionRecord('zone.move', {
              polygon: nextPolygon,
              zoneId: zoneDrag.zoneId
            }),
            nextEncounter
          })
        );
        dispatch(
          selectEntity({
            entityType: 'zone',
            ids: [zoneDrag.zoneId]
          })
        );
      }

      setZoneDrag(
        zoneDrag.hasMoved
          ? {
              ...zoneDrag,
              phase: 'committed'
            }
          : null
      );
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
        vertexDrag.zoneId,
        encounter.canvasSize
      )
    ) {
      logEncounterValidationFailure(dispatch, encounter, {
        actionType: 'zone.reshape',
        code: 'zone.invalidPolygonPlacement',
        message: 'A zone must remain within the canvas and must not overlap another zone.',
        payload: { polygon: vertexDrag.polygon, zoneId: vertexDrag.zoneId }
      });
      setVertexDrag(null);
      return;
    }

    const nextEncounter = updateZonePolygon(
      encounter,
      vertexDrag.zoneId,
      vertexDrag.polygon
    );
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('zone.reshape', {
        polygon: vertexDrag.polygon,
        ...(resizedZone
          ? {
              resizeAnchor: getZoneResizeAnchor(
                resizedZone,
                vertexDrag.polygon,
                vertexDrag.vertexIndex
              )
            }
          : {}),
        zoneId: vertexDrag.zoneId
      }),
      currentEncounter: encounter,
      nextEncounter
    });

    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      const committedPolygon =
        resolved.nextEncounter.zones.byId[vertexDrag.zoneId]?.polygon ??
        vertexDrag.polygon;

      if (
        resolved.blocked ||
        !canCommitZonePolygonForCollection(
          committedPolygon,
          encounter.zones,
          vertexDrag.zoneId,
          encounter.canvasSize
        )
      ) {
        const pipelineRejected = logEncounterValidationBlock(
          dispatch,
          resolved
        );
        if (!pipelineRejected) {
          logEncounterValidationFailure(dispatch, encounter, {
            actionType: 'zone.reshape',
            code: 'zone.invalidPolygonPlacement',
            message: 'A zone must remain within the canvas and must not overlap another zone.',
            payload: { polygon: committedPolygon, zoneId: vertexDrag.zoneId }
          });
        }
        setVertexDrag(null);
        return;
      }

      dispatch(
        commitEncounterChange({
          action: {
            ...resolved.action,
            payload: {
              ...resolved.action.payload,
              polygon: committedPolygon,
              requestedPolygon: vertexDrag.polygon
            }
          },
          nextEncounter: resolved.nextEncounter
        })
      );
      dispatch(
        selectEntity({
          entityType: 'zone',
          ids: [vertexDrag.zoneId]
        })
      );
      setVertexDrag(null);
    };

    if (prepared instanceof Promise) {
      void prepared.then(commitPrepared);
    } else {
      commitPrepared(prepared);
    }
  }

  return handleCanvasMouseUp;
}
