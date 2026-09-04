import { GoogleDriveAssetRepository } from "@core/persistence/cloud";
import type { LocalSyncRepository } from "@core/persistence";

describe("GoogleDriveAssetRepository", () => {
  it("uses cached Drive bytes without persisting or requesting an OAuth token", async () => {
    const blob = new Blob(["cached"], { type: "image/png" });
    const cache = {
      getCachedAsset: vi.fn().mockResolvedValue({ key: "drive:file-1", blob, byteLength: blob.size, lastAccessedAt: 1 })
    } as unknown as LocalSyncRepository;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const repository = new GoogleDriveAssetRepository(
      () => "user@example.com",
      cache,
      { apiKey: "key", appId: "project", clientId: "client" }
    );

    await expect(repository.download("file-1")).resolves.toBe(blob);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
