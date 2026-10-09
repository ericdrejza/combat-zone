import type { LayoutPoint } from '@core/layout/types';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import type { GridConfiguration } from './types';
import { calibratedRotation, rotationPeriod } from './gridRotation';
import { gridAngle, gridToWorld, snapToGrid, worldToGrid } from './gridGeometry';
import { fitGridWarp, warpFitsCanvas } from './gridWarp';

/** Square corners or consecutive hex vertices provide visible calibration references. */
export function calibrateGrid(grid: GridConfiguration, points: LayoutPoint[]): GridConfiguration | null {
  if (points.length !== (grid.type === 'square' ? 4 : 3)) return null;
  const [a, b, c] = points;
  const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: c.x - b.x, y: c.y - b.y };
  const lengthU = Math.hypot(u.x, u.y), lengthV = Math.hypot(v.x, v.y);
  const cross = u.x * v.y - u.y * v.x;
  if (lengthU < 1 || lengthV < 1 || Math.abs(cross) / (lengthU * lengthV) < 0.2) return null;
  const sign = Math.sign(cross), expected = (grid.type === 'square' ? Math.PI / 2 : Math.PI / 3) * sign;
  const thetaU = Math.atan2(u.y, u.x), thetaV = Math.atan2(v.y, v.x) - expected;
  let theta = Math.atan2(Math.sin(thetaU) + Math.sin(thetaV), Math.cos(thetaU) + Math.cos(thetaV));
  let edge = (lengthU + lengthV) / 2;
  if (grid.type === 'square') {
    const vectors = points.map((point, i) => ({ x: points[(i + 1) % 4].x - point.x, y: points[(i + 1) % 4].y - point.y }));
    if (vectors.some(vector => Math.hypot(vector.x, vector.y) < 1)) return null;
    const angles = vectors.map((vector, i) => Math.atan2(vector.y, vector.x) - i * expected);
    theta = Math.atan2(angles.reduce((sum, angle) => sum + Math.sin(angle), 0), angles.reduce((sum, angle) => sum + Math.cos(angle), 0));
    edge = vectors.reduce((sum, vector) => sum + Math.hypot(vector.x, vector.y), 0) / 4;
  }
  const rawAngle = theta * 180 / Math.PI - (grid.type === 'square' ? 0 : sign * 120);
  const rotation = calibratedRotation(rawAngle - (grid.type === 'hex-pointy' ? 30 : 0), grid.type);
  let origin = { ...a };
  if (grid.type !== 'square') {
    const angle = rotation + (grid.type === 'hex-pointy' ? 30 : 0);
    const vertexAngle = (angle + Math.round((rawAngle - angle) / 60) * 60) * Math.PI / 180;
    origin = { x: a.x - edge * Math.cos(vertexAngle), y: a.y - edge * Math.sin(vertexAngle) };
  }
  const { warp: _warp, ...standard } = grid;
  return { ...standard, origin, cellSize: edge * (grid.type === 'square' ? 1 : Math.sqrt(3)), rotation, visible: true };
}

export type QuadrantAlignment = { standard: GridConfiguration; warped: GridConfiguration | null; distortion: number };
/** Four cell samples estimate lattice addresses, then fit every observed vertex. */
export function calibrateQuadrants(grid: GridConfiguration, points: LayoutPoint[], canvas: CanvasSize): QuadrantAlignment | null {
  const count = grid.type === 'square' ? 4 : 3;
  if (points.length !== count * 4) return null;
  const fits = Array.from({ length: 4 }, (_, i) => calibrateGrid(grid, points.slice(i * count, i * count + count)));
  if (fits.some(fit => !fit)) return null;
  const valid = fits as GridConfiguration[], period = rotationPeriod(grid.type);
  const angle = Math.atan2(valid.reduce((s, fit) => s + Math.sin(fit.rotation * 2 * Math.PI / period), 0),
    valid.reduce((s, fit) => s + Math.cos(fit.rotation * 2 * Math.PI / period), 0)) * period / (2 * Math.PI);
  let standard = { ...valid[0], cellSize: valid.reduce((s, fit) => s + fit.cellSize, 0) / 4,
    rotation: calibratedRotation(angle, grid.type) };
  const offsets = valid.map(fit => {
    const nearest = snapToGrid(standard, fit.origin, grid.type === 'square' ? 'large' : 'medium');
    return { x: fit.origin.x - nearest.x, y: fit.origin.y - nearest.y };
  });
  standard = { ...standard, origin: { x: standard.origin.x + offsets.reduce((s, p) => s + p.x, 0) / 4,
    y: standard.origin.y + offsets.reduce((s, p) => s + p.y, 0) / 4 } };
  const samples: { source: LayoutPoint; target: LayoutPoint }[] = [];
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = points.slice(i * count, i * count + count);
    const sign = Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
    let vertices: LayoutPoint[];
    if (grid.type === 'square') {
      const first = worldToGrid(standard, snapToGrid(standard, a, 'large'));
      const theta = Math.atan2(b.y - a.y, b.x - a.x) - gridAngle(standard);
      const direction = Math.round(theta / (Math.PI / 2)) * Math.PI / 2;
      const second = { x: first.x + standard.cellSize * Math.cos(direction), y: first.y + standard.cellSize * Math.sin(direction) };
      vertices = [first, second, { x: second.x + standard.cellSize * Math.cos(direction + sign * Math.PI / 2),
        y: second.y + standard.cellSize * Math.sin(direction + sign * Math.PI / 2) },
        { x: first.x + standard.cellSize * Math.cos(direction + sign * Math.PI / 2), y: first.y + standard.cellSize * Math.sin(direction + sign * Math.PI / 2) }];
    } else {
      const center = worldToGrid(standard, snapToGrid(standard, valid[i].origin, 'medium'));
      const theta = Math.atan2(a.y - valid[i].origin.y, a.x - valid[i].origin.x) - gridAngle(standard);
      const direction = Math.round(theta / (Math.PI / 3)) * Math.PI / 3;
      vertices = [0, 1, 2].map(k => ({ x: center.x + standard.cellSize / Math.sqrt(3) * Math.cos(direction + k * sign * Math.PI / 3),
        y: center.y + standard.cellSize / Math.sqrt(3) * Math.sin(direction + k * sign * Math.PI / 3) }));
    }
    vertices.forEach((vertex, k) => {
      const target = worldToGrid(standard, points[i * count + k]);
      samples.push({ source: { x: vertex.x / standard.cellSize, y: vertex.y / standard.cellSize },
        target: { x: target.x / standard.cellSize, y: target.y / standard.cellSize } });
    });
  }
  const warp = fitGridWarp(samples), candidate = warp ? { ...standard, warp } : null;
  const warped = candidate && warpFitsCanvas(candidate, canvas) ? candidate : null;
  const distortion = Math.sqrt(samples.reduce((sum, sample) => {
    const source = gridToWorld(standard, { x: sample.source.x * standard.cellSize, y: sample.source.y * standard.cellSize });
    const target = gridToWorld(standard, { x: sample.target.x * standard.cellSize, y: sample.target.y * standard.cellSize });
    return sum + (source.x - target.x) ** 2 + (source.y - target.y) ** 2;
  }, 0) / samples.length);
  return { standard, warped, distortion };
}
