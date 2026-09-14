import {
  IMAGE_COMPRESSION_STRATEGIES,
  type ImageCompressionStrategy,
  type ImageCompressionStrategyId
} from "./imageCompression";

export const IMAGE_COMPRESSION_STORAGE_KEY = "combat-zone.image-compression-strategy";

export const IMAGE_COMPRESSION_OPTIONS: ReadonlyArray<{
  description: string;
  label: string;
  value: ImageCompressionStrategyId;
}> = [
  { description: "Stores uploaded PNG and JPEG files unchanged.", label: "None", value: "none" },
  { description: "Uses smaller WebP files at the browser's maximum quality.", label: "WebP (maximum quality)", value: "maximum_quality_webp" },
  { description: "Uses smaller WebP files with balanced compression and quality.", label: "WebP (balanced compression)", value: "lossy_webp" }
];

export function readImageCompressionStrategyId(): ImageCompressionStrategyId {
  try {
    const stored = localStorage.getItem(IMAGE_COMPRESSION_STORAGE_KEY);
    if (stored === "maximum_quality_webp" || stored === "lossy_webp") return stored;
    // Preserve the pre-release preference name used by the initial strategy implementation.
    return stored === "lossless_webp" ? "maximum_quality_webp" : "none";
  } catch {
    return "none";
  }
}

export function writeImageCompressionStrategyId(strategy: ImageCompressionStrategyId): void {
  try {
    localStorage.setItem(IMAGE_COMPRESSION_STORAGE_KEY, strategy);
  } catch {
    // The default remains usable when browser preference storage is unavailable.
  }
}

export function getSelectedImageCompressionStrategy(): ImageCompressionStrategy {
  return IMAGE_COMPRESSION_STRATEGIES[readImageCompressionStrategyId()];
}
