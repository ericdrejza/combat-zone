import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import type { EncounterState } from "@core/encounter/types";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { updateActorProperties } from "@entities/actor/actorMutations";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode, LibrarySection } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch } from "@store/store";

type ApplyActorTokenFromLibraryOptions = {
  actorId: string;
  dispatch: AppDispatch;
  encounter: EncounterState;
  node: LibraryNode;
  tokens: LibrarySection;
};

/** Applies a selected Library token as one validated, history-tracked actor change. */
export function applyActorTokenFromLibrary({
  actorId,
  dispatch,
  encounter,
  node,
  tokens
}: ApplyActorTokenFromLibraryOptions) {
  const actor = encounter.actors.byId[actorId];
  const asset = resolveLibraryAsset(tokens, node.id);
  if (!actor || !asset) return;

  const properties = {
    image: asset.source,
    imageLibraryNodeId: node.id
  };
  const prepared = prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord("actor.updateProperties", {
      actorId,
      properties
    }),
    currentEncounter: encounter,
    nextEncounter: updateActorProperties(encounter, actorId, properties)
  });
  const commit = (resolved: Awaited<typeof prepared>) => {
    if (!logEncounterValidationBlock(dispatch, resolved) && !resolved.blocked) {
      dispatch(commitEncounterChange({
        action: resolved.action,
        nextEncounter: resolved.nextEncounter
      }));
    }
  };

  if (prepared instanceof Promise) void prepared.then(commit);
  else commit(prepared);
}
