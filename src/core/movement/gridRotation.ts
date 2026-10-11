import type { GridType } from './types';

export const rotationPeriod = (type: GridType) => type === 'isometric' ? 180 : type === 'square' ? 90 : 60;
export function normalizeGridRotation(rotation: number, _type: GridType): number {
  const period = 360;
  const result = Math.round((((rotation % period) + period) % period) * 100) / 100;
  return Math.abs(result) < 1e-8 || Math.abs(result - period) < 1e-8 ? 0 : result;
}
/** Calibration forgives small click errors and keeps a canonical lattice orientation. */
export function calibratedRotation(rotation: number, type: GridType): number {
  const nearest = Math.round(rotation / 45) * 45;
  const snapped = Math.abs(nearest - rotation) <= 5 + 1e-8 ? nearest : rotation;
  const period = rotationPeriod(type);
  return normalizeGridRotation(((snapped % period) + period) % period, type) % period;
}
export function stepWholeNumber(value: number, direction: 1 | -1): number {
  return direction === 1 ? Math.floor(value) + 1 : Math.ceil(value) - 1;
}

/** Held rotation keeps fractional steps until reaching the next whole degree. */
export function stepGridRotation(value: number, direction: 1 | -1, accelerated: boolean): number {
  const rounded = Math.round(value * 100) / 100;
  if (accelerated && Number.isInteger(rounded)) return rounded + direction;
  const next = Math.round((rounded + direction * 0.1) * 100) / 100;
  if (!accelerated) return next;
  const whole = stepWholeNumber(rounded, direction);
  return direction === 1 ? Math.min(next, whole) : Math.max(next, whole);
}
