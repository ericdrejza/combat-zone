import type { ActorShape } from './types';

/** Unframed artwork retains a square placement box independent of image aspect ratio. */
export function actorFootprintShape(shape: ActorShape): 'circle' | 'rectangle' {
  return shape === 'circle' ? 'circle' : 'rectangle';
}
