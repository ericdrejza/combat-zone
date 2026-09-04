import { createEncounterState } from "@core/encounter/createEncounterState";
import { serializeEncounterForCloud, type CloudAssetRepository } from "@core/persistence/cloud";

describe("cloud serialization", () => {
  it("does not submit Drive or HTTP references to object storage", async () => {
    const state = createEncounterState({ id: "encounter-1", name: "Encounter" });
    state.backgroundImage = {
      source: { kind: "google_drive", fileId: "drive-1" },
      height: 10, mediaType: "image/png", name: "Map", width: 10
    };
    state.actors.byId.actor = {
      id: "actor", name: "Actor", actorType: "creature", currentZoneId: "zoneless",
      image: { kind: "url", url: "https://example.com/token.png" }, layoutGroup: "enemy",
      metadata: {}, shape: "circle", size: "medium", statusEffects: []
    };
    state.actors.allIds = ["actor"];
    const ensureUploaded = vi.fn();
    const assets = {
      ensureUploaded,
      download: vi.fn(),
      getUsage: vi.fn()
    } as unknown as CloudAssetRepository;

    const result = await serializeEncounterForCloud({ state, updatedAt: 1 }, assets);

    expect(ensureUploaded).not.toHaveBeenCalled();
    expect(result.state.backgroundImage?.source).toEqual({ kind: "google_drive", fileId: "drive-1" });
    expect(result.assetIds).toEqual([]);
  });

  it("uploads embedded sources before returning cloud references", async () => {
    const state = createEncounterState({ id: "encounter-1", name: "Encounter" });
    state.backgroundImage = {
      source: { kind: "embedded", dataUrl: "data:image/png;base64,AA==" },
      height: 10, mediaType: "image/png", name: "Map", width: 10
    };
    const assetId = "a".repeat(64);
    const ensureUploaded = vi.fn().mockResolvedValue({ kind: "cloud_storage", assetId, generation: "2" });
    const assets = { ensureUploaded, download: vi.fn(), getUsage: vi.fn() } as unknown as CloudAssetRepository;

    const result = await serializeEncounterForCloud({ state, updatedAt: 1 }, assets);

    expect(ensureUploaded).toHaveBeenCalledOnce();
    expect(result.assetIds).toEqual([assetId]);
  });
});
