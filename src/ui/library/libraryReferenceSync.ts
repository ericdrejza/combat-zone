import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { replaceEncounterLibraryAssetReferences } from "@library/libraryReferences";
import type { LibraryImageAsset, LibrarySection } from "@library/types";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { AppDispatch } from "@store/store";
import type { EncounterState } from "@core/encounter/types";

export function syncLibraryAssetReferences(options: {
  asset: LibraryImageAsset;
  dispatch: AppDispatch;
  encounter: EncounterState;
  nodeId: string;
  section: LibrarySection;
}): void {
  const nextEncounter = replaceEncounterLibraryAssetReferences(
    options.encounter,
    options.section,
    options.nodeId,
    options.asset
  );

  if (nextEncounter === options.encounter) {
    return;
  }

  const prepared = prepareValidatedEncounterChangeForRuntime({
    action: createEncounterActionRecord("library.asset.changeSource", {
      libraryNodeId: options.nodeId,
      sectionId: options.section.id
    }),
    currentEncounter: options.encounter,
    nextEncounter
  });
  const commit = (resolved: Awaited<typeof prepared>) => {
    if (!logEncounterValidationBlock(options.dispatch, resolved) && !resolved.blocked) {
      options.dispatch(commitEncounterChange({
        action: resolved.action,
        nextEncounter: resolved.nextEncounter
      }));
    }
  };

  if (prepared instanceof Promise) {
    void prepared.then(commit);
  } else {
    commit(prepared);
  }
}
