import path from 'path';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { createActor, moveActor } from '@entities/actor/actorMutations';
import { selectEntity, setActiveTool } from '@interaction/interactionState';
import { resolveLibraryAsset } from '@library/librarySlice';
import { commitEncounterChange } from '@store/encounterSlice';
import { logEncounterValidationBlock } from '@store/encounterLogSlice';
import type { AppDispatch, RootState } from '@store/store';
import type { NewActorDragData } from '../toolbar/actor/actorCreationDrag';
import { readImageFile } from '../toolbar/background/readImageFile';
import type { LayoutPoint } from '@core/layout/types';
import { setOptimisticActorPlacement } from './actors/actorPlacementOptimisticState';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { commitBackgroundImage } from '../toolbar/background/backgroundCanvasActions';

type CanvasDropContext = {
  actorTool: RootState['interaction']['actorTool'];
  dispatch: AppDispatch;
  encounter: RootState['encounter']['present'];
  library: RootState['library'];
};

function commitCreatedActor(
  context: CanvasDropContext,
  input: Parameters<typeof createActor>[1],
  destinationZoneId: string,
  dropPoint?: LayoutPoint
): void {
  const actorId = input.id;
  const nextEncounter = createActor(context.encounter, input);
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord('actor.create', {
      actorId,
      destinationZoneId
    }),
    currentEncounter: context.encounter,
    nextEncounter
  });

  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
    if (resolved.blocked) {
      logEncounterValidationBlock(context.dispatch, resolved);
      return;
    }

    if (dropPoint && destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
      setOptimisticActorPlacement(actorId, dropPoint);
    }

    context.dispatch(
      commitEncounterChange({
        action: resolved.action,
        nextEncounter: resolved.nextEncounter
      })
    );
    context.dispatch(selectEntity({ entityType: 'actor', ids: [actorId] }));
  };

  if (prepared instanceof Promise) {
    void prepared.then(commitPrepared);
  } else {
    commitPrepared(prepared);
  }
}

export function commitActorFromLibraryNode(
  context: CanvasDropContext,
  nodeId: string,
  destinationZoneId: string,
  dropPoint?: LayoutPoint
): void {
  const asset = resolveLibraryAsset(context.library.sections.tokens, nodeId);

  if (!asset) {
    return;
  }

  const actorId = `actor-${Date.now()}`;
  commitCreatedActor(
    context,
    {
      currentZoneId: destinationZoneId,
      id: actorId,
      image: asset,
      layoutGroup: context.actorTool.layoutGroup,
      shape: context.actorTool.shape,
      size: context.actorTool.size
    },
    destinationZoneId,
    dropPoint
  );
}

export function commitActorFromCreation(
  context: CanvasDropContext,
  data: NewActorDragData,
  destinationZoneId: string,
  dropPoint?: LayoutPoint
): void {
  const actorId = `actor-${Date.now()}`;
  commitCreatedActor(
    context,
    {
      currentZoneId: destinationZoneId,
      id: actorId,
      layoutGroup: data.layoutGroup,
      name: data.name,
      shape: data.shape,
      size: data.size
    },
    destinationZoneId,
    dropPoint
  );
}

export async function commitActorFromImage(
  context: CanvasDropContext,
  file: File,
  destinationZoneId: string,
  dropPoint?: LayoutPoint
) {
  const image = await readImageFile(file);
  const actorId = `actor-${Date.now()}`;
  commitCreatedActor(
    context,
    {
      currentZoneId: destinationZoneId,
      id: actorId,
      image,
      layoutGroup: context.actorTool.layoutGroup,
      name: path.parse(image.name).name,
      shape: context.actorTool.shape,
      size: context.actorTool.size
    },
    destinationZoneId,
    dropPoint
  );
}

export async function commitBackgroundFromFile(
  context: Pick<CanvasDropContext, 'dispatch' | 'encounter'>,
  file: File,
  viewportSize: CanvasSize,
  viewportZoom: number
) {
  const nextBackgroundImage = await readImageFile(file);
  commitBackgroundImage({
    backgroundImage: nextBackgroundImage,
    dispatch: context.dispatch,
    encounter: context.encounter,
    viewportSize,
    viewportZoom
  });
  context.dispatch(setActiveTool('zone'));
}

export function moveActorsToZone(
  context: Pick<CanvasDropContext, 'dispatch' | 'encounter'>,
  actorIds: string[],
  destinationZoneId: string,
  selectActors = false,
  dropPoint?: LayoutPoint
): void {
  const nextEncounter = actorIds.reduce(
    (currentEncounter, actorId) =>
      moveActor(currentEncounter, actorId, destinationZoneId),
    context.encounter
  );
  const action = createEncounterActionRecord(
    actorIds.length > 1 ? 'actor.moveMany' : 'actor.move',
    {
      actorIds,
      destinationZoneId
    }
  );
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action,
    currentEncounter: context.encounter,
    nextEncounter
  });

  const commitPrepared = (resolved: Awaited<typeof prepared>) => {
    if (resolved.blocked || nextEncounter === context.encounter) {
      logEncounterValidationBlock(context.dispatch, resolved);
      return;
    }

    if (dropPoint && destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
      actorIds.forEach((actorId) =>
        setOptimisticActorPlacement(actorId, dropPoint)
      );
    }

    context.dispatch(
      commitEncounterChange({
        action: resolved.action,
        nextEncounter: resolved.nextEncounter
      })
    );

    if (selectActors) {
      context.dispatch(selectEntity({ entityType: 'actor', ids: actorIds }));
    }
  };

  if (prepared instanceof Promise) {
    void prepared.then(commitPrepared);
  } else {
    commitPrepared(prepared);
  }
}

export function getMovableActorIds(
  encounter: RootState['encounter']['present'],
  actorIds: string[],
  destinationZoneId: string
) {
  return actorIds.filter(
    (actorId) =>
      encounter.actors.byId[actorId]?.currentZoneId !== destinationZoneId
  );
}
