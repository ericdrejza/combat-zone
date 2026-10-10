import type { LayoutPoint } from '@core/layout/types';

export type MovementStrategy = 'zone' | 'grid' | 'free';
export type GridType = 'square' | 'hex-pointy' | 'hex-flat';
/** A bilinear alignment maps normalized lattice coordinates into distorted local coordinates. */
export type GridWarp = { type: 'bilinear'; x: [number, number, number, number]; y: [number, number, number, number] };
export type GridConfiguration = {
  type: GridType;
  /** User-facing map scale: halving this value doubles map coverage. */
  cellSize: number;
  origin: LayoutPoint;
  rotation: number;
  visible: boolean;
  color: string;
  opacity: number;
  warp?: GridWarp;
};

export function createDefaultGrid(): GridConfiguration {
  return { type: 'square', cellSize: 64, origin: { x: 0, y: 0 }, rotation: 0,
    visible: false, color: '#808080', opacity: 0.5 };
}

export function validGrid(value: unknown): value is GridConfiguration {
  if (!value || typeof value !== 'object') return false;
  const grid = value as GridConfiguration;
  return ['square', 'hex-pointy', 'hex-flat'].includes(grid.type) &&
    Number.isFinite(grid.cellSize) && grid.cellSize > 0 &&
    !!grid.origin && Number.isFinite(grid.origin.x) && Number.isFinite(grid.origin.y) &&
    Number.isFinite(grid.rotation) && typeof grid.visible === 'boolean' &&
    typeof grid.color === 'string' && /^#[0-9a-f]{6}$/i.test(grid.color) &&
    Number.isFinite(grid.opacity) && grid.opacity >= 0 && grid.opacity <= 1 &&
    (grid.warp === undefined || validGridWarp(grid.warp));
}

export function validGridWarp(value: unknown): value is GridWarp {
  if (!value || typeof value !== 'object') return false;
  const warp = value as GridWarp;
  return warp.type === 'bilinear' && [warp.x, warp.y].every(values => Array.isArray(values) && values.length === 4 && values.every(Number.isFinite));
}
