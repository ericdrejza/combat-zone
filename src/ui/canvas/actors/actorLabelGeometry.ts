import type { ActorShape } from '@entities/actor/types';
import { DEFAULT_ISOMETRIC_ANGLE } from '@core/movement/types';

/** Upright names follow the projected screen-space bottom, keeping a fixed text gap. */
export function actorLabelOffset(shape: ActorShape, radius: number, rotation?: number, angle = DEFAULT_ISOMETRIC_ANGLE): number {
  if (rotation === undefined) return radius + 16;
  const radians = rotation * Math.PI / 180;
  const a = Math.sin(radians), b = Math.tan(angle * Math.PI / 180) * Math.cos(radians);
  const extent = shape === 'circle' ? Math.hypot(a, b) * Math.SQRT1_2 : Math.max(Math.abs(a), Math.abs(b));
  return radius * extent + 16;
}
