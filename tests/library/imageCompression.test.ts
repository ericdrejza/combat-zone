import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IMAGE_COMPRESSION_STRATEGIES,
  LOSSY_WEBP_UPLOAD_QUALITY
} from "@library/imageCompression";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function animatedPng(): Blob {
  return new Blob([new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 0, 97, 99, 84, 76,
    0, 0, 0, 0
  ])], { type: "image/png" });
}

describe("library image compression", () => {
  it("leaves uploads untouched by default", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL");

    await expect(IMAGE_COMPRESSION_STRATEGIES.none.compress(
      new Blob(["png"], { type: "image/png" }),
      "image/png",
      "map.png"
    )).resolves.toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("does not flatten animated PNG uploads", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL");

    await expect(IMAGE_COMPRESSION_STRATEGIES.lossy_webp.compress(
      animatedPng(),
      "image/png",
      "torch.png"
    )).resolves.toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("falls back when the browser does not return WebP", async () => {
    class LoadedImage extends EventTarget {
      naturalHeight = 400;
      naturalWidth = 500;

      set src(_value: string) {
        queueMicrotask(() => this.dispatchEvent(new Event("load")));
      }
    }
    vi.stubGlobal("Image", LoadedImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));

    await expect(IMAGE_COMPRESSION_STRATEGIES.lossy_webp.compress(
      new Blob(["jpeg"], { type: "image/jpeg" }),
      "image/jpeg",
      "portrait.jpg"
    )).resolves.toBeNull();
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", LOSSY_WEBP_UPLOAD_QUALITY);
  });

  it("uses quality 1 for the maximum-quality WebP strategy", async () => {
    class LoadedImage extends EventTarget {
      naturalHeight = 400;
      naturalWidth = 500;

      set src(_value: string) {
        queueMicrotask(() => this.dispatchEvent(new Event("load")));
      }
    }
    vi.stubGlobal("Image", LoadedImage);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:source");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation((callback, type) => callback(new Blob(["webp"], { type: type ?? "" })));

    const result = await IMAGE_COMPRESSION_STRATEGIES.maximum_quality_webp.compress(
      new Blob([new Uint8Array(64)], { type: "image/png" }),
      "image/png",
      "map.png"
    );

    expect(result).toMatchObject({ mediaType: "image/webp", name: "map.webp" });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/webp", 1);
  });
});
