import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { getActorEngagement } from '@core/encounter/inspectors';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { moveActor } from '@entities/actor/actorMutations';
import {
  createEngagement,
  joinEngagement,
  leaveEngagements,
  moveActorsPreservingCompleteEngagements
} from '@entities/engagement/engagementMutations';
import { isSameEngagementDrop } from '@entities/engagement/engagementDrop';
import { selectEntity } from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import {
  logEncounterValidationBlock
} from '@store/encounterLogSlice';
import { findZoneIdAtPoint } from '../actors/actorCanvasLayout';
import {
  findActorIdAtPoint,
  findEngagementIdAtPoint
} from '../engagements/engagementHitTesting';
import { isWithinEngagementTether } from '../engagements/engagementDragRules';
import type { ActorDragState } from '../canvasInteractionTypes';
import {
  cacheActorDropPoints,
  createSnapBackDrag
} from './actorDragHelpers';
import type { MouseUpHandlerInput } from './mouseUpTypes';

function commitPreparedActorChange(
  input: MouseUpHandlerInput,
  actorDrag: ActorDragState,
  prepared: Awaited<ReturnType<typeof prepareValidatedEncounterChangeForRuntime>>,
  cacheDropPoints: boolean,
  clearActorDrag = false
): void {
  if (!prepared.blocked) {
    if (cacheDropPoints) {
      cacheActorDropPoints(actorDrag, input.actorRenderPlacements);
    }
    input.dispatch(
      commitEncounterChange({
        action: prepared.action,
        nextEncounter: prepared.nextEncounter
      })
    );
    input.dispatch(
      selectEntity({ entityType: 'actor', ids: actorDrag.actorIds })
    );
    input.setActorDrag(
      clearActorDrag
        ? null
        : {
            ...actorDrag,
            phase: 'returning',
            returnPointsByActorId: undefined
          }
    );
    return;
  }

  logEncounterValidationBlock(input.dispatch, prepared);
  input.setActorDrag(createSnapBackDrag(actorDrag));
}

function commitActorEngagementDrop(
  input: MouseUpHandlerInput,
  actorDrag: ActorDragState,
  targetActorId: string | undefined,
  targetGroupId: string | undefined
): boolean {
  const { encounter } = input;
  let engagementActionType: string | undefined;
  let nextEncounter: typeof encounter | undefined;

  if (
    targetGroupId &&
    actorDrag.engagementIntentEngagementId === targetGroupId
  ) {
    nextEncounter = joinEngagement(encounter, targetGroupId, actorDrag.actorIds);
    engagementActionType = 'engagement.join';
  } else if (targetGroupId) {
    const parentZoneId = encounter.engagements.byId[targetGroupId]?.parentZoneId;
    if (parentZoneId) {
      nextEncounter = moveActorsPreservingCompleteEngagements(
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
    const parentZoneId = encounter.actors.byId[targetActorId]?.currentZoneId;
    if (parentZoneId && parentZoneId !== ZONELESS_ACTOR_ZONE_ID) {
      nextEncounter = createEngagement(encounter, {
        id: `engagement-${Date.now()}`,
        parentZoneId,
        participantIds: [...actorDrag.actorIds, targetActorId]
      });
      engagementActionType = 'engagement.create';
    }
  } else if (targetActorId) {
    // A quick actor drop has ordinary move semantics: place the dragged actors
    // in the target zone without creating or joining a group.
    const parentZoneId = encounter.actors.byId[targetActorId]?.currentZoneId;
    if (parentZoneId) {
      nextEncounter = moveActorsPreservingCompleteEngagements(
        encounter,
        actorDrag.actorIds,
        parentZoneId
      );
      engagementActionType = 'actor.moveMany';
    }
  }

  if (!nextEncounter || nextEncounter === encounter) {
    return false;
  }

  const action = createEncounterActionRecord(engagementActionType!, {
    actorIds: actorDrag.actorIds,
    participantIds: targetActorId
      ? [...actorDrag.actorIds, targetActorId]
      : actorDrag.actorIds,
    ...(targetGroupId
      ? { parentZoneId: encounter.engagements.byId[targetGroupId]?.parentZoneId }
      : {}),
    ...(targetActorId ? { targetActorId } : {}),
    ...(targetGroupId ? { targetEngagementId: targetGroupId } : {})
  });
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action,
    currentEncounter: encounter,
    nextEncounter
  });
  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
    if (!resolved.blocked) {
      cacheActorDropPoints(actorDrag, input.actorRenderPlacements);
      input.dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
      input.dispatch(
        selectEntity({ entityType: 'actor', ids: actorDrag.actorIds })
      );
      input.setActorDrag({
        ...actorDrag,
        phase: 'returning',
        returnPointsByActorId: undefined
      });
      return;
    }
    logEncounterValidationBlock(input.dispatch, resolved);
    input.setActorDrag(createSnapBackDrag(actorDrag));
  };
  if (prepared instanceof Promise) void prepared.then(commitPrepared);
  else commitPrepared(prepared);
  return true;
}

function commitActorZoneDrop(
  input: MouseUpHandlerInput,
  actorDrag: ActorDragState,
  destinationZoneId: string
): void {
  const { encounter } = input;
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
    nextEncounter = leaveEngagements(nextEncounter, actorDrag.actorIds);
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
      commitPreparedActorChange(
        input,
        actorDrag,
        resolved,
        destinationZoneId !== ZONELESS_ACTOR_ZONE_ID,
        destinationZoneId === ZONELESS_ACTOR_ZONE_ID
      );
      return;
    }
    logEncounterValidationBlock(input.dispatch, resolved);
    input.setActorDrag(createSnapBackDrag(actorDrag));
  };
  if (prepared instanceof Promise) void prepared.then(commitPrepared);
  else commitPrepared(prepared);
}

/** Finalize an actor drag. Returns true when an actor drag was present. */
export function handleActorMouseUp(input: MouseUpHandlerInput): boolean {
  const { actorDrag, encounter } = input;
  if (!actorDrag) return false;
  if (!actorDrag.hasMoved) {
    input.setActorDrag(null);
    return true;
  }

  const draggedActorEngagement = getActorEngagement(encounter, actorDrag.actorId);
  if (
    draggedActorEngagement &&
    isWithinEngagementTether(actorDrag.start, actorDrag.current)
  ) {
    input.setActorDrag(createSnapBackDrag(actorDrag));
    return true;
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
  if (isSameEngagementDrop(encounter, actorDrag.actorIds, targetGroupId)) {
    input.setActorDrag(createSnapBackDrag(actorDrag));
    return true;
  }

  if (commitActorEngagementDrop(input, actorDrag, targetActorId, targetGroupId)) {
    return true;
  }

  const destinationZoneId =
    findZoneIdAtPoint(encounter, actorDrag.current) ?? ZONELESS_ACTOR_ZONE_ID;
  const changesZone = actorDrag.actorIds.some(
    (actorId) => encounter.actors.byId[actorId]?.currentZoneId !== destinationZoneId
  );
  const leavesEngagement = actorDrag.actorIds.some((actorId) =>
    Boolean(getActorEngagement(encounter, actorId))
  );
  if (!changesZone && !leavesEngagement) {
    input.setActorDrag(createSnapBackDrag(actorDrag));
    return true;
  }

  commitActorZoneDrop(input, actorDrag, destinationZoneId);
  return true;
}
