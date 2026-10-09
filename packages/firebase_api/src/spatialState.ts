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
    if (state.schemaVersion !== 18 || !warp || warp.type !== 'bilinear' ||
      ![warp.x, warp.y].every(values => Array.isArray(values) && values.length === 4 && values.every(value => typeof value === 'number' && Number.isFinite(value)))) fail();
  }
  for (const actor of Object.values(actors.byId)) {
    if (actor.spatialPosition === undefined) continue;
    const point = actor.spatialPosition as Record<string, unknown> | null;
    if (!point || typeof point.x !== 'number' || !Number.isFinite(point.x) || typeof point.y !== 'number' || !Number.isFinite(point.y)) fail();
  }
}
