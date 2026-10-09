import type { GridType } from './types';

export const rotationPeriod = (type: GridType) => type === 'square' ? 90 : 60;
export function normalizeGridRotation(rotation: number, type: GridType): number {
  const period = rotationPeriod(type);
  const result = ((rotation % period) + period) % period;
  return Math.abs(result) < 1e-8 || Math.abs(result - period) < 1e-8 ? 0 : result;
}
/** Calibration forgives small click errors near familiar orientations. */
export function calibratedRotation(rotation: number, type: GridType): number {
  const nearest = Math.round(rotation / 45) * 45;
  return normalizeGridRotation(Math.abs(nearest - rotation) <= 5 + 1e-8 ? nearest : rotation, type);
}
export function stepWholeNumber(value: number, direction: 1 | -1): number {
  return direction === 1 ? Math.floor(value) + 1 : Math.ceil(value) - 1;
}
