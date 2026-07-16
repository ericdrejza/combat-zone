import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "@core/validation/validatedEncounterChange";
import {
  createActor,
  moveActor,
  stripFileExtension
} from "@entities/actor/actorMutations";
import { selectEntity, setActiveTool } from "@interaction/interactionState";
import { resolveLibraryAsset } from "@library/librarySlice";
import { commitEncounterChange } from "@store/encounterSlice";
import type { AppDispatch, RootState } from "@store/store";
import type { NewActorDragData } from "../toolbar/actor/actorCreationDrag";
import { readImageFile } from "../toolbar/background/readImageFile";
import type { LayoutPoint } from "@core/layout/types";
import { setOptimisticActorPlacement } from "./actorPlacementOptimisticState";

type CanvasDropContext = {
  actorTool: RootState["interaction"]["actorTool"];
  dispatch: AppDispatch;
  encounter: RootState["encounter"]["present"];
  library: RootState["library"];
};

function commitCreatedActor(
  context: CanvasDropContext,
  input: Parameters<typeof createActor>[1],
  destinationZoneId: string,
  dropPoint?: LayoutPoint
) {
  const actorId = input.id;
  const nextEncounter = createActor(context.encounter, input);
  const prepared = prepareValidatedEncounterChange({
    action: createEncounterActionRecord("actor.create", {
      actorId,
      destinationZoneId
    }),
    currentEncounter: context.encounter,
    nextEncounter
  });

  if (!prepared.blocked) {
    if (dropPoint && destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
      setOptimisticActorPlacement(actorId, dropPoint);
    }

    context.dispatch(
      commitEncounterChange({
        action: prepared.action,
        nextEncounter: prepared.nextEncounter
      })
    );
    context.dispatch(selectEntity({ entityType: "actor", ids: [actorId] }));
  }
}

export function commitActorFromLibraryNode(
  context: CanvasDropContext,
  nodeId: string,
  destinationZoneId: string,
  dropPoint?: LayoutPoint
) {
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
) {
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
      name: stripFileExtension(image.name),
      shape: context.actorTool.shape,
      size: context.actorTool.size
    },
    destinationZoneId,
    dropPoint
  );
}

export async function commitBackgroundFromFile(
  context: Pick<CanvasDropContext, "dispatch" | "encounter">,
  file: File
) {
  const nextBackgroundImage = await readImageFile(file);
  const actionType = context.encounter.backgroundImage
    ? "background.replace"
    : "background.add";

  context.dispatch(
    commitEncounterChange({
      action: createEncounterActionRecord(actionType, {
        backgroundImage: nextBackgroundImage
      }),
      nextEncounter: {
        ...context.encounter,
        backgroundImage: nextBackgroundImage
      }
    })
  );
  context.dispatch(setActiveTool("zone"));
}

export function moveActorsToZone(
  context: Pick<CanvasDropContext, "dispatch" | "encounter">,
  actorIds: string[],
  destinationZoneId: string,
  selectActors = false,
  dropPoint?: LayoutPoint
) {
  const nextEncounter = actorIds.reduce(
    (currentEncounter, actorId) =>
      moveActor(currentEncounter, actorId, destinationZoneId),
    context.encounter
  );
  const action = createEncounterActionRecord(
    actorIds.length > 1 ? "actor.moveMany" : "actor.move",
    {
      actorIds,
      destinationZoneId
    }
  );
  const prepared = prepareValidatedEncounterChange({
    action,
    currentEncounter: context.encounter,
    nextEncounter
  });

  if (!prepared.blocked && nextEncounter !== context.encounter) {
    if (dropPoint && destinationZoneId !== ZONELESS_ACTOR_ZONE_ID) {
      actorIds.forEach((actorId) =>
        setOptimisticActorPlacement(actorId, dropPoint)
      );
    }

    context.dispatch(
      commitEncounterChange({
        action: prepared.action,
        nextEncounter: prepared.nextEncounter
      })
    );

    if (selectActors) {
      context.dispatch(selectEntity({ entityType: "actor", ids: actorIds }));
    }
  }
}

export function getMovableActorIds(
  encounter: RootState["encounter"]["present"],
  actorIds: string[],
  destinationZoneId: string
) {
  return actorIds.filter(
    (actorId) =>
      encounter.actors.byId[actorId]?.currentZoneId !== destinationZoneId
  );
}
