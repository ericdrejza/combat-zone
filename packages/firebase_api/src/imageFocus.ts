/** A crop in normalized source coordinates; source bytes remain untouched. */
export type ImageFocus = { x: number; y: number; width: number; height: number };

/** Bounds also enforce the editor's 100–400% zoom range. */
export function isImageFocus(value: unknown, dimensions?: { width?: unknown; height?: unknown }): value is ImageFocus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { x, y, width, height } = value as ImageFocus;
  if (typeof dimensions?.width === "number" && typeof dimensions.height === "number" &&
    dimensions.width > 0 && dimensions.height > 0 &&
    Math.abs(width * dimensions.width - height * dimensions.height) > 1e-6 * Math.max(dimensions.width, dimensions.height)) return false;
  return [x, y, width, height].every(Number.isFinite) &&
    x >= 0 && y >= 0 && width > 0 && height > 0 &&
    x + width <= 1 + 1e-9 && y + height <= 1 + 1e-9 &&
    Math.max(width, height) >= 0.25 - 1e-9 && Math.max(width, height) <= 1;
}
