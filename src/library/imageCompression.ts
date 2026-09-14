const COMPRESSIBLE_MEDIA_TYPES = new Set(["image/jpeg", "image/png"]);

/** Balances tabletop detail with a substantial reduction from camera JPEGs and PNG maps. */
export const LOSSY_WEBP_UPLOAD_QUALITY = 0.88;

export type ImageCompressionStrategyId = "none" | "maximum_quality_webp" | "lossy_webp";

export type CompressedLibraryImage = {
  blob: Blob;
  height: number;
  mediaType: "image/webp";
  name: string;
  width: number;
};

function isAnimatedPng(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const chunkLength = view.getUint32(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > bytes.length) return false;
    const chunkType = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (chunkType === "acTL") return true;
    if (chunkType === "IEND") return false;
    offset = chunkEnd;
  }

  return false;
}

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      reader.result instanceof ArrayBuffer
        ? resolve(reader.result)
        : reject(new Error("Selected image could not be read."));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Selected image could not be read.")));
    reader.readAsArrayBuffer(blob);
  });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(blob);
    const image = new Image();
    const release = () => URL.revokeObjectURL(source);
    image.addEventListener("load", () => {
      release();
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      release();
      reject(new Error("Selected image could not be decoded."));
    }, { once: true });
    image.src = source;
  });
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}

function webpName(name: string): string {
  return /\.[^.]+$/.test(name) ? name.replace(/\.[^.]+$/, ".webp") : `${name}.webp`;
}

export type ImageCompressionStrategy = {
  compress(blob: Blob, mediaType: string, name: string): Promise<CompressedLibraryImage | null>;
  id: ImageCompressionStrategyId;
};

function createWebpStrategy(
  id: Exclude<ImageCompressionStrategyId, "none">,
  quality: number
): ImageCompressionStrategy {
  return {
    id,
    async compress(blob, mediaType, name) {
      return compressLibraryImageToWebp(blob, mediaType, name, quality);
    }
  };
}

/** Canvas failures preserve the original, so compression never blocks an upload. */
async function compressLibraryImageToWebp(
  blob: Blob,
  mediaType: string,
  name: string,
  quality: number
): Promise<CompressedLibraryImage | null> {
  const normalizedType = mediaType.toLowerCase();
  if (!COMPRESSIBLE_MEDIA_TYPES.has(normalizedType)) return null;

  try {
    if (normalizedType === "image/png" && isAnimatedPng(new Uint8Array(await readBytes(blob)))) {
      return null;
    }

    const image = await loadImage(blob);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const compressed = await encodeWebp(canvas, quality);
    if (!compressed || compressed.type !== "image/webp" || compressed.size >= blob.size) return null;

    return {
      blob: compressed,
      height,
      mediaType: "image/webp",
      name: webpName(name),
      width
    };
  } catch {
    return null;
  }
}

export const IMAGE_COMPRESSION_STRATEGIES: Record<ImageCompressionStrategyId, ImageCompressionStrategy> = {
  none: {
    id: "none",
    compress: async () => null
  },
  maximum_quality_webp: createWebpStrategy("maximum_quality_webp", 1),
  lossy_webp: createWebpStrategy("lossy_webp", LOSSY_WEBP_UPLOAD_QUALITY)
};
