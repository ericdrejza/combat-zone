import { describe, expect, it } from "vitest";

import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { replaceEncounterLibraryAssetReferences } from "@library/libraryReferences";
import libraryReducer from "@library/librarySlice";

const originalAsset = {
  mediaType: "image/png",
  name: "original.png",
  source: { kind: "embedded" as const, dataUrl: "data:image/png;base64,original" },
  width: 100,
  height: 80
};

const replacementAsset = {
  mediaType: "image/webp",
  name: "replacement.webp",
  source: { kind: "url" as const, url: "https://example.com/replacement.webp" },
  width: 200,
  height: 160
};

describe("replaceEncounterLibraryAssetReferences", () => {
  it("updates every actor image that references the changed token node", () => {
    const initialTokens = libraryReducer(undefined, { type: "test/init" })
      .sections.tokens;
    const tokens = {
      ...initialTokens,
      nodesById: {
        ...initialTokens.nodesById,
        "token-node": {
          asset: originalAsset,
          id: "token-node",
          name: originalAsset.name,
          parentId: initialTokens.rootId,
          sectionId: "tokens" as const,
          type: "image" as const
        }
      }
    };
    const encounter = createActor(
      createActor(
        createEncounterState({ id: "encounter", name: "Encounter" }),
        {
          currentZoneId: "zoneless",
          id: "linked-actor",
          image: { ...originalAsset, libraryNodeId: "token-node" }
        }
      ),
      {
        currentZoneId: "zoneless",
        id: "other-actor",
        image: { ...originalAsset, libraryNodeId: "other-node" }
      }
    );

    const next = replaceEncounterLibraryAssetReferences(
      encounter,
      tokens,
      "token-node",
      replacementAsset
    );

    expect(next.actors.byId["linked-actor"]?.image).toEqual(
      replacementAsset.source
    );
    expect(next.actors.byId["linked-actor"]?.metadata).toMatchObject({
      sourceAssetMediaType: replacementAsset.mediaType,
      sourceAssetName: replacementAsset.name,
      sourceLibraryNodeId: "token-node"
    });
    expect(next.actors.byId["other-actor"]?.image).toEqual(originalAsset.source);
  });

  it("updates a background reference including its replacement dimensions", () => {
    const initialBackgrounds = libraryReducer(undefined, { type: "test/init" })
      .sections.backgrounds;
    const backgrounds = {
      ...initialBackgrounds,
      nodesById: {
        ...initialBackgrounds.nodesById,
        "background-node": {
          asset: originalAsset,
          id: "background-node",
          name: originalAsset.name,
          parentId: initialBackgrounds.rootId,
          sectionId: "backgrounds" as const,
          type: "image" as const
        }
      }
    };
    const encounter = {
      ...createEncounterState({ id: "encounter", name: "Encounter" }),
      backgroundImage: {
        ...originalAsset,
        libraryNodeId: "background-node"
      }
    };

    const next = replaceEncounterLibraryAssetReferences(
      encounter,
      backgrounds,
      "background-node",
      replacementAsset
    );

    expect(next.backgroundImage).toEqual({
      ...replacementAsset,
      libraryNodeId: "background-node"
    });
  });

  it("updates actors that reference links to the changed token asset", () => {
    const initialTokens = libraryReducer(undefined, { type: "test/init" })
      .sections.tokens;
    const tokens = {
      ...initialTokens,
      nodesById: {
        ...initialTokens.nodesById,
        "token-node": {
          asset: originalAsset,
          id: "token-node",
          name: originalAsset.name,
          parentId: initialTokens.rootId,
          sectionId: "tokens" as const,
          type: "image" as const
        },
        "token-link": {
          id: "token-link",
          name: "Linked token",
          parentId: initialTokens.rootId,
          sectionId: "tokens" as const,
          targetId: "token-node",
          type: "link" as const
        }
      }
    };
    const encounter = createActor(
      createEncounterState({ id: "encounter", name: "Encounter" }),
      {
        currentZoneId: "zoneless",
        id: "linked-actor",
        image: { ...originalAsset, libraryNodeId: "token-link" }
      }
    );

    const next = replaceEncounterLibraryAssetReferences(
      encounter,
      tokens,
      "token-node",
      replacementAsset
    );

    expect(next.actors.byId["linked-actor"]?.image).toEqual(
      replacementAsset.source
    );
    expect(next.actors.byId["linked-actor"]?.metadata.sourceLibraryNodeId)
      .toBe("token-link");
  });
});
