import type { EncounterState } from "@core/encounter/types";
import type { LibraryImageAsset, LibrarySection } from "./types";

function getAffectedReferenceNodeIds(
  section: LibrarySection,
  changedNodeId: string
): Set<string> {
  const affectedNodeIds = new Set([changedNodeId]);
  const changedNode = section.nodesById[changedNodeId];

  // A link is itself a referenceable Library node. When an image node changes,
  // every link resolving to that image must refresh as well. Replacing a link's
  // source only affects that link because links cannot target other links.
  if (changedNode?.type === "image") {
    for (const node of Object.values(section.nodesById)) {
      if (node.type === "link" && node.targetId === changedNodeId) {
        affectedNodeIds.add(node.id);
      }
    }
  }

  return affectedNodeIds;
}

/**
 * Keeps the encounter's denormalized image data aligned with its Library
 * references. The node ID remains the source of identity for the reference.
 */
export function replaceEncounterLibraryAssetReferences(
  encounter: EncounterState,
  section: LibrarySection,
  nodeId: string,
  asset: LibraryImageAsset
): EncounterState {
  const affectedNodeIds = getAffectedReferenceNodeIds(section, nodeId);
  let nextEncounter = encounter;

  if (
    section.id === "backgrounds" &&
    encounter.backgroundImage?.libraryNodeId !== undefined &&
    affectedNodeIds.has(encounter.backgroundImage.libraryNodeId)
  ) {
    nextEncounter = {
      ...nextEncounter,
      backgroundImage: {
        ...encounter.backgroundImage,
        height: asset.height ?? encounter.backgroundImage.height,
        mediaType: asset.mediaType,
        name: asset.name,
        source: asset.source,
        width: asset.width ?? encounter.backgroundImage.width
      }
    };
  }

  if (section.id !== "tokens") {
    return nextEncounter;
  }

  const nextActorsById = { ...encounter.actors.byId };
  let actorsChanged = false;

  for (const actorId of encounter.actors.allIds) {
    const actor = encounter.actors.byId[actorId];

    if (
      !actor?.image ||
      typeof actor.metadata.sourceLibraryNodeId !== "string" ||
      !affectedNodeIds.has(actor.metadata.sourceLibraryNodeId)
    ) {
      continue;
    }

    nextActorsById[actorId] = {
      ...actor,
      image: asset.source,
      metadata: {
        ...actor.metadata,
        sourceAssetMediaType: asset.mediaType,
        sourceAssetName: asset.name
      }
    };
    actorsChanged = true;
  }

  return actorsChanged
    ? {
        ...nextEncounter,
        actors: {
          ...encounter.actors,
          byId: nextActorsById
        }
      }
    : nextEncounter;
}
