import type { Actor, ActorSize } from '@entities/actor/types';
import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { GridConfiguration } from './types';
import { unwarpPoint, warpPoint, warpDerivative } from './gridWarp';

const dimensions: Record<ActorSize, number> = { small: 0.6, medium: 0.9, large: 1.8, xLarge: 2.7 };
export function spatialActorRadius(actor: Pick<Actor, 'size'>, grid: GridConfiguration, point?: LayoutPoint) {
  let scale = 1;
  if (grid.warp && point) {
    const local = worldToGrid(grid, point);
    const { a, b, c, d, determinant } = warpDerivative(grid.warp, { x: local.x / grid.cellSize, y: local.y / grid.cellSize });
    const sum = a * a + b * b + c * c + d * d;
    scale = Math.sqrt(Math.max(0, (sum - Math.sqrt(Math.max(0, sum * sum - 4 * determinant * determinant))) / 2));
  }
  return grid.cellSize * dimensions[actor.size] * scale / 2;
}
export const gridAngle = (grid: GridConfiguration) => (grid.rotation + (grid.type === 'hex-pointy' ? 30 : 0)) * Math.PI / 180;

export function gridToWorld(grid: GridConfiguration, point: LayoutPoint): LayoutPoint {
  if (grid.warp) { const mapped = warpPoint(grid.warp, { x: point.x / grid.cellSize, y: point.y / grid.cellSize }); point = { x: mapped.x * grid.cellSize, y: mapped.y * grid.cellSize }; }
  const angle = gridAngle(grid), c = Math.cos(angle), s = Math.sin(angle);
  return { x: grid.origin.x + point.x * c - point.y * s, y: grid.origin.y + point.x * s + point.y * c };
}
export function worldToGrid(grid: GridConfiguration, point: LayoutPoint): LayoutPoint {
  const angle = gridAngle(grid), c = Math.cos(angle), s = Math.sin(angle);
  const x = point.x - grid.origin.x, y = point.y - grid.origin.y;
  const local = { x: x * c + y * s, y: -x * s + y * c };
  if (!grid.warp) return local;
  const mapped = unwarpPoint(grid.warp, { x: local.x / grid.cellSize, y: local.y / grid.cellSize });
  return { x: mapped.x * grid.cellSize, y: mapped.y * grid.cellSize };
}
export function footprintFits(point: LayoutPoint, radius: number, canvas: CanvasSize): boolean {
  return point.x >= radius - 1e-7 && point.y >= radius - 1e-7 &&
    point.x + radius <= canvas.width + 1e-7 && point.y + radius <= canvas.height + 1e-7;
}

/** Local candidates avoid storing redundant cell addresses, including hex vertex anchors. */
export function nearbyAnchors(grid: GridConfiguration, point: LayoutPoint, size: ActorSize, range = 2): LayoutPoint[] {
  const local = worldToGrid(grid, point), cell = grid.cellSize;
  const result: LayoutPoint[] = [];
  if (grid.type === 'square') {
    const shift = size === 'large' ? 0 : 0.5;
    const q = Math.round(local.x / cell - shift), r = Math.round(local.y / cell - shift);
    for (let i = -range; i <= range; i++) for (let j = -range; j <= range; j++) {
      result.push(gridToWorld(grid, { x: (q + i + shift) * cell, y: (r + j + shift) * cell }));
    }
  } else {
    const radius = cell / Math.sqrt(3);
    const q = Math.round(local.x / (1.5 * radius));
    const r = Math.round(local.y / cell - q / 2);
    for (let i = -range; i <= range; i++) for (let j = -range; j <= range; j++) {
      const center = { x: (q + i) * 1.5 * radius, y: (r + j + (q + i) / 2) * cell };
      if (size !== 'large') result.push(gridToWorld(grid, center));
      else for (let k = 0; k < 6; k++) result.push(gridToWorld(grid, {
        x: center.x + radius * Math.cos(k * Math.PI / 3),
        y: center.y + radius * Math.sin(k * Math.PI / 3)
      }));
    }
  }
  return result;
}
const distanceSquared = (a: LayoutPoint, b: LayoutPoint) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
export function nearestPoint(points: LayoutPoint[], point: LayoutPoint): LayoutPoint {
  return points.sort((a, b) => distanceSquared(a, point) - distanceSquared(b, point) || a.y - b.y || a.x - b.x)[0] ?? point;
}
export function snapToGrid(grid: GridConfiguration, point: LayoutPoint, size: ActorSize): LayoutPoint {
  return nearestPoint(nearbyAnchors(grid, point, size), point);
}

/** Configuration changes find a nearby fitting anchor; pointer drops are validated rather than clamped. */
export function nearestFittingAnchor(grid: GridConfiguration, point: LayoutPoint, actor: Actor, canvas: CanvasSize): LayoutPoint {
  const radius = spatialActorRadius(actor, grid, point);
  const clamped = { x: Math.max(radius, Math.min(canvas.width - radius, point.x)),
    y: Math.max(radius, Math.min(canvas.height - radius, point.y)) };
  return nearestPoint(nearbyAnchors(grid, clamped, actor.size, 3).filter(p => footprintFits(p, spatialActorRadius(actor, grid, p), canvas)), point);
}

export function gridKeyboardStep(grid: GridConfiguration, point: LayoutPoint, size: ActorSize, direction: LayoutPoint): LayoutPoint {
  const candidates = nearbyAnchors(grid, point, size).filter(p => distanceSquared(p, point) > 1e-8);
  // The anchor lattice is square, triangular (hex centers), or honeycomb (hex vertices).
  const local = worldToGrid(grid, point);
  const latticeDistance = (p: LayoutPoint) => distanceSquared(worldToGrid(grid, p), local);
  const nearestDistance = Math.min(...candidates.map(latticeDistance));
  const neighbors = candidates.filter(p => latticeDistance(p) < nearestDistance + 1e-5);
  return neighbors.sort((a, b) => {
    const dot = (p: LayoutPoint) => (p.x - point.x) * direction.x + (p.y - point.y) * direction.y;
    return dot(b) - dot(a) || a.y - b.y || a.x - b.x;
  })[0] ?? point;
}
