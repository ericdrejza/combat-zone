import type { LockedRuler } from './types';

/** Ignore draft object identity so re-locking unchanged geometry never consumes an undo step. */
export function rulersEqual(a: readonly LockedRuler[], b: readonly LockedRuler[]): boolean {
  return a.length === b.length && a.every((ruler, index) => {
    const other = b[index];
    return ruler.id === other.id && ruler.name === other.name && ruler.color === other.color && ruler.opacity === other.opacity
      && ruler.options.shape === other.options.shape && ruler.options.angle === other.options.angle
      && ruler.points.length === other.points.length && ruler.points.every((point, i) => point.x === other.points[i].x && point.y === other.points[i].y);
  });
}
