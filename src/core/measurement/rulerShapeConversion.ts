import type { LockedRuler, RulerShape } from './types';

/** AoEs have two endpoints; converting a longer Path would discard placed waypoints. */
export function canConvertRulerShape(ruler: Pick<LockedRuler, 'options' | 'points'>, shape: RulerShape): boolean {
  return ruler.options.shape !== 'path' || shape === 'path' || ruler.points.length <= 2;
}
