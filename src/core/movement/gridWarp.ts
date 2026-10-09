import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { GridWarp, GridConfiguration } from './types';

const evaluate = (terms: number[], point: LayoutPoint) => terms[0] + terms[1] * point.x + terms[2] * point.y + terms[3] * point.x * point.y;
export function warpPoint(warp: GridWarp, point: LayoutPoint): LayoutPoint {
  return { x: evaluate(warp.x, point), y: evaluate(warp.y, point) };
}
export function warpDerivative(warp: GridWarp, point: LayoutPoint) {
  const a = warp.x[1] + warp.x[3] * point.y, b = warp.x[2] + warp.x[3] * point.x;
  const c = warp.y[1] + warp.y[3] * point.y, d = warp.y[2] + warp.y[3] * point.x;
  return { a, b, c, d, determinant: a * d - b * c };
}

/** Newton inversion rejects singular/folded geometry instead of returning an arbitrary cell. */
export function unwarpPoint(warp: GridWarp, target: LayoutPoint): LayoutPoint {
  const point = { ...target };
  for (let i = 0; i < 30; i++) {
    const mapped = warpPoint(warp, point), derivative = warpDerivative(warp, point);
    if (Math.abs(derivative.determinant) < 1e-8) break;
    const x = mapped.x - target.x, y = mapped.y - target.y;
    if (Math.hypot(x, y) < 1e-9) return point;
    point.x -= (derivative.d * x - derivative.b * y) / derivative.determinant;
    point.y -= (-derivative.c * x + derivative.a * y) / derivative.determinant;
  }
  return { x: NaN, y: NaN };
}

/** Full-canvas inversion and positive Jacobians keep calibration from folding cells. */
export function warpFitsCanvas(grid: GridConfiguration, canvas: CanvasSize): boolean {
  if (!grid.warp) return true;
  const angle = (grid.rotation + (grid.type === 'hex-pointy' ? 30 : 0)) * Math.PI / 180;
  const c = Math.cos(angle), s = Math.sin(angle);
  const sources: LayoutPoint[] = [];
  for (const x of [0, canvas.width / 2, canvas.width]) for (const y of [0, canvas.height / 2, canvas.height]) {
    const dx = (x - grid.origin.x) / grid.cellSize, dy = (y - grid.origin.y) / grid.cellSize;
    const source = unwarpPoint(grid.warp, { x: dx * c + dy * s, y: -dx * s + dy * c });
    if (!Number.isFinite(source.x) || !Number.isFinite(source.y)) return false;
    sources.push(source);
  }
  const xs = sources.map(p => p.x), ys = sources.map(p => p.y);
  for (const x of [Math.min(...xs), Math.max(...xs)]) for (const y of [Math.min(...ys), Math.max(...ys)]) {
    if (warpDerivative(grid.warp, { x, y }).determinant < 0.05) return false;
  }
  return true;
}

function solve(matrix: number[][], values: number[]): number[] | null {
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let i = 0; i < 4; i++) {
    let pivot = i;
    for (let j = i + 1; j < 4; j++) if (Math.abs(rows[j][i]) > Math.abs(rows[pivot][i])) pivot = j;
    if (Math.abs(rows[pivot][i]) < 1e-10) return null;
    [rows[i], rows[pivot]] = [rows[pivot], rows[i]];
    const divisor = rows[i][i];
    for (let k = i; k <= 4; k++) rows[i][k] /= divisor;
    for (let j = 0; j < 4; j++) if (j !== i) {
      const multiplier = rows[j][i];
      for (let k = i; k <= 4; k++) rows[j][k] -= multiplier * rows[i][k];
    }
  }
  return rows.map(row => row[4]);
}
export function fitGridWarp(samples: { source: LayoutPoint; target: LayoutPoint }[]): GridWarp | null {
  const matrix = Array.from({ length: 4 }, () => Array(4).fill(0) as number[]);
  const x = Array(4).fill(0) as number[], y = [...x];
  for (const { source, target } of samples) {
    const row = [1, source.x, source.y, source.x * source.y];
    for (let i = 0; i < 4; i++) {
      x[i] += row[i] * target.x; y[i] += row[i] * target.y;
      for (let j = 0; j < 4; j++) matrix[i][j] += row[i] * row[j];
    }
  }
  const a = solve(matrix, x), b = solve(matrix, y);
  return a && b ? { type: 'bilinear', x: a as GridWarp['x'], y: b as GridWarp['y'] } : null;
}
