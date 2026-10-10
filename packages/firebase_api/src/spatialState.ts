import { ApiContractValidationError } from './errors.js';

/** Schema 18 adds optional bilinear alignment; older spatial documents remain readable. */
export function validateSpatialState(state: Record<string, unknown>): void {
  const fail = () => { throw new ApiContractValidationError('Encounter spatial configuration is invalid.'); };
  const grid = state.grid as Record<string, unknown> | null;
  const origin = grid?.origin as Record<string, unknown> | null;
  if (!['zone', 'grid', 'free'].includes(String(state.movementStrategy)) ||
    !grid || !['square', 'hex-pointy', 'hex-flat'].includes(String(grid.type)) ||
    typeof grid.cellSize !== 'number' || !Number.isFinite(grid.cellSize) || grid.cellSize <= 0 ||
    !origin || typeof origin.x !== 'number' || !Number.isFinite(origin.x) || typeof origin.y !== 'number' || !Number.isFinite(origin.y) ||
    typeof grid.rotation !== 'number' || !Number.isFinite(grid.rotation) || typeof grid.visible !== 'boolean' ||
    typeof grid.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(grid.color) ||
    typeof grid.opacity !== 'number' || !Number.isFinite(grid.opacity) || grid.opacity < 0 || grid.opacity > 1) fail();
  const actors = state.actors as { byId: Record<string, Record<string, unknown>> };
  if (grid?.warp !== undefined) {
    const warp = grid.warp as Record<string, unknown> | null;
    if ((state.schemaVersion !== 18 && state.schemaVersion !== 19 && state.schemaVersion !== 20 && state.schemaVersion !== 21) || !warp || warp.type !== 'bilinear' ||
      ![warp.x, warp.y].every(values => Array.isArray(values) && values.length === 4 && values.every(value => typeof value === 'number' && Number.isFinite(value)))) fail();
  }
  if (state.gridCoverage !== undefined) {
    const coverage = state.gridCoverage as { x: number; y: number; width: number; height: number } | null;
    const canvas = state.canvasSize as { width: number; height: number };
    if (state.schemaVersion !== 20 && state.schemaVersion !== 21 || state.backgroundImage !== null || !coverage || !canvas ||
        ![coverage.x, coverage.y, coverage.width, coverage.height].every(value => typeof value === 'number' && Number.isFinite(value)) ||
        coverage.x < 0 || coverage.y < 0 || coverage.width <= 0 || coverage.height <= 0 ||
        coverage.x + coverage.width > canvas.width + 1e-7 || coverage.y + coverage.height > canvas.height + 1e-7) fail();
  }
  const background = state.backgroundImage as Record<string, unknown> | null;
  if (background?.frame !== undefined) {
    const frame = background.frame as Record<string, unknown> | null;
    const canvas = state.canvasSize as { width: number; height: number };
    if ((state.schemaVersion !== 19 && state.schemaVersion !== 20 && state.schemaVersion !== 21) || !frame || !canvas ||
        ![frame.x, frame.y, frame.width, frame.height].every(value => typeof value === 'number' && Number.isFinite(value)) ||
        (frame.x as number) < 0 || (frame.y as number) < 0 || (frame.width as number) <= 0 || (frame.height as number) <= 0 ||
        (frame.x as number) + (frame.width as number) > canvas.width + 1e-7 ||
        (frame.y as number) + (frame.height as number) > canvas.height + 1e-7) fail();
  }
  for (const actor of Object.values(actors.byId)) {
    if (actor.spatialPosition === undefined) continue;
    const point = actor.spatialPosition as Record<string, unknown> | null;
    if (!point || typeof point.x !== 'number' || !Number.isFinite(point.x) || typeof point.y !== 'number' || !Number.isFinite(point.y)) fail();
  }
}
