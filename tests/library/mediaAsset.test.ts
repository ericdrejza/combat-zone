import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupportedLibraryMediaType,
  isAnimatedAsset,
  isSupportedLibraryMediaFile,
  isVideoMediaType,
  readLibraryMediaFile
} from "@library/mediaAsset";
import reducer, { uploadImage } from "@library/librarySlice";
import { IMAGE_COMPRESSION_STRATEGIES } from "@library/imageCompression";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("library media assets", () => {
  it("accepts MP4 and WebM uploads, including files without a browser MIME type", () => {
    const mp4 = new File(["video"], "mist.mp4", { type: "video/mp4" });
    const webmWithoutMime = new File(["video"], "torch.webm");

    expect(isSupportedLibraryMediaFile(mp4)).toBe(true);
    expect(getSupportedLibraryMediaType(webmWithoutMime)).toBe("video/webm");
    expect(isVideoMediaType("video/mp4")).toBe(true);
    expect(isVideoMediaType("video/quicktime")).toBe(false);
  });

  it("stores supported video assets and rejects unsupported video media", () => {
    const mp4 = {
      height: 1080,
      mediaType: "video/mp4",
      name: "mist.mp4",
      source: { kind: "embedded" as const, dataUrl: "data:video/mp4;base64,AA==" },
      width: 1920
    };
    const state = reducer(undefined, uploadImage({
      asset: mp4,
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));
    const childId = state.sections.backgrounds.nodesById["backgrounds-root"].childIds?.[0] as string;

    expect(state.sections.backgrounds.nodesById[childId].asset).toEqual(mp4);

    const unsupported = reducer(state, uploadImage({
      asset: { ...mp4, mediaType: "video/quicktime", name: "mist.mov" },
      parentId: "backgrounds-root",
      sectionId: "backgrounds"
    }));

    expect(unsupported.sections.backgrounds.nodesById["backgrounds-root"].childIds).toEqual([childId]);
  });

  it("recognizes animated WebP assets from their embedded RIFF animation flag", () => {
    const bytes = new Uint8Array([
      82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80,
      86, 80, 56, 88, 10, 0, 0, 0, 2, 0, 0, 0
    ]);
    const dataUrl = `data:image/webp;base64,${btoa(String.fromCharCode(...bytes))}`;

    expect(isAnimatedAsset({
      mediaType: "image/webp",
      name: "flame.webp",
      source: { dataUrl, kind: "embedded" }
    })).toBe(true);
  });

  it("compresses PNG uploads before repository storage without creating a data URL", async () => {
    class LoadedImage extends EventTarget {
      naturalHeight = 600;
      naturalWidth = 800;

      set src(_value: string) {
        queueMicrotask(() => this.dispatchEvent(new Event("load")));
      }
    }
    const createObjectURL = vi.spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:upload-preview");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    vi.stubGlobal("Image", LoadedImage);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback, type) => callback(new Blob(["webp"], { type: type ?? "" })));
    const file = new File(["image bytes"], "map.png", { type: "image/png" });
    const source = {
      kind: "local_asset" as const,
      assetId: "a".repeat(64),
      byteLength: 4
    };
    const storeLocalAsset = vi.fn(async () => source);

    await expect(readLibraryMediaFile(
      file,
      storeLocalAsset,
      IMAGE_COMPRESSION_STRATEGIES.lossy_webp
    )).resolves.toMatchObject({
      height: 600,
      mediaType: "image/webp",
      name: "map.webp",
      width: 800,
      source
    });
    expect(storeLocalAsset).toHaveBeenCalledWith(expect.objectContaining({ type: "image/webp" }));
    expect(drawImage).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:upload-preview");
  });
});
