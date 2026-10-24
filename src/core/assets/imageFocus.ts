import type { CSSProperties } from "react";
export { isImageFocus, type ImageFocus } from "@combat-zone/firebase-api";
import type { ImageFocus } from "@combat-zone/firebase-api";

export type ImageDimensions = { width: number; height: number };
const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Zoom is relative to the smallest centered square that covers the frame. */
export function focusAtZoom(dimensions: ImageDimensions, zoom: number, previous?: ImageFocus): ImageFocus {
  const side = Math.min(dimensions.width, dimensions.height) / Math.max(1, Math.min(4, zoom));
  const width = side / dimensions.width;
  const height = side / dimensions.height;
  return {
    x: clamp((previous ? previous.x + previous.width / 2 : 0.5) - width / 2, 1 - width),
    y: clamp((previous ? previous.y + previous.height / 2 : 0.5) - height / 2, 1 - height),
    width, height
  };
}

export function moveFocus(focus: ImageFocus, dx: number, dy: number): ImageFocus {
  return { ...focus, x: clamp(focus.x - dx * focus.width, 1 - focus.width), y: clamp(focus.y - dy * focus.height, 1 - focus.height) };
}

/** Places the original artwork behind a unit-square viewport. */
export function focusImageBox(focus: ImageFocus) {
  return { x: -focus.x / focus.width, y: -focus.y / focus.height, width: 1 / focus.width, height: 1 / focus.height };
}

export function focusImageStyle(focus: ImageFocus): CSSProperties {
  const box = focusImageBox(focus);
  return { position: "absolute", left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` };
}

export function sameImageFocus(a?: ImageFocus, b?: ImageFocus): boolean {
  return a === b || Boolean(a && b && ["x", "y", "width", "height"].every(key => Math.abs(a[key as keyof ImageFocus] - b[key as keyof ImageFocus]) < 1e-9));
}
