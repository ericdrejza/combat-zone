import type { CanvasSize } from "@core/layout/polygonCanvasBounds";
import type { LayoutPoint } from "@core/layout/types";
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";

/** Pan at the current zoom only when the complete selected token bounds fit. */
export function actorGroupNavigationPoint(placements: readonly Pick<ActorRenderPlacement, "point" | "radius">[], viewport: CanvasSize, zoom: number): LayoutPoint | null {
  if (!placements.length || viewport.width <= 0 || viewport.height <= 0 || !Number.isFinite(zoom) || zoom <= 0) return null;
  const left = Math.min(...placements.map(({ point, radius }) => point.x - radius));
  const right = Math.max(...placements.map(({ point, radius }) => point.x + radius));
  const top = Math.min(...placements.map(({ point, radius }) => point.y - radius));
  const bottom = Math.max(...placements.map(({ point, radius }) => point.y + radius));
  if ((right - left) * zoom > viewport.width || (bottom - top) * zoom > viewport.height) return null;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}
