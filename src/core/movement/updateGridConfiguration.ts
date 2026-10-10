import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { runValidationPipelineSync } from '@core/validation/pipeline';
import { PolygonPlacementValidator } from '@core/validation/polygonFlexPlacementValidator';
import { CanvasBoundsValidator } from '@core/validation/canvasBoundsValidator';
import { SpatialValidator } from './spatialValidator';
import type { EncounterState } from '@core/encounter/types';
import { overflowingSpatialActorIds, unplaceOverflowingSpatialActors, type BackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { clampCanvasResizeToValidLayout } from '@core/encounter/clampCanvasResize';
import { getGridCoverage } from './gridCoverage';
import type { GridConfiguration } from './types';
import type { GridGeometry } from './gridScale';
import { GRID_SPACING } from './gridScale';
import { completeGridEdges } from './gridEdgeCompletion';
import { resnapSpatialActors } from './movementStrategies';

/** Cell-size edits resize map coverage, never the physical lattice or actor footprints. */
export function updateGridConfiguration(state: EncounterState, grid: GridConfiguration,
  overflowBehavior: BackgroundResizeOverflowBehavior = 'zoneless'): EncounterState {
  if (grid.cellSize === state.grid.cellSize)
    return resnapSpatialActors(completeGridEdges({ ...state, grid }));
  return resizeGridMap(state, grid, state.grid.cellSize / grid.cellSize, overflowBehavior, 'grid.update');
}

/** Fitted spacing is measured geometry, not the persisted user-facing map scale. */
export function applyGridAlignment(state: EncounterState, fitted: GridGeometry,
  overflowBehavior: BackgroundResizeOverflowBehavior = 'zoneless'): EncounterState {
  const scale = GRID_SPACING / fitted.cellSize;
  const coverage = getGridCoverage(state);
  const base = { ...state, grid: { ...fitted, cellSize: state.grid.cellSize } };
  const resized = resizeEncounterCanvas(base, { canvasSize: {
    width: coverage.width * scale, height: coverage.height * scale
  }, zoneScale: scale, overflowBehavior: 'clamp' });
  const next = finishGridMapResize(state, resized, overflowBehavior, fitted.origin);
  // A larger clamped map would no longer match the measured image cells.
  const fit = runValidationPipelineSync({ state, nextState: next, mode: 'OFF',
    action: { type: 'grid.calibrate', payload: {} },
    validators: [PolygonPlacementValidator, CanvasBoundsValidator, SpatialValidator] });
  return overflowingSpatialActorIds(next).length || !fit.valid ? state : next;
}

function resizeGridMap(state: EncounterState, grid: GridConfiguration, scale: number,
  overflowBehavior: BackgroundResizeOverflowBehavior, actionType: string): EncounterState {
  const coverage = getGridCoverage(state);
  // The resize helper updates the scale value once from the actual accepted dimensions.
  const base = { ...state, grid: { ...grid, cellSize: state.grid.cellSize } };
  const finalize = (candidate: EncounterState) => finishGridMapResize(state, candidate, overflowBehavior);
  return clampCanvasResizeToValidLayout(state, base,
    { width: coverage.width * scale, height: coverage.height * scale },
    scale, actionType, overflowBehavior, finalize).encounter;
}

function finishGridMapResize(state: EncounterState, candidate: EncounterState,
  overflowBehavior: BackgroundResizeOverflowBehavior, fittedOrigin?: GridConfiguration['origin']) {
  const coverage = getGridCoverage(state);
  if (fittedOrigin) {
    const frame = getGridCoverage(candidate);
    const acceptedScale = frame.width / coverage.width;
    candidate = { ...candidate, grid: { ...candidate.grid, origin: {
      x: frame.x + (fittedOrigin.x - coverage.x) * acceptedScale,
      y: frame.y + (fittedOrigin.y - coverage.y) * acceptedScale
    } } };
    candidate = completeGridEdges(candidate);
  }
  if (overflowBehavior === 'zoneless') candidate = unplaceOverflowingSpatialActors(candidate);
  else if (overflowingSpatialActorIds(candidate).length) return candidate;
  return resnapSpatialActors(candidate);
}
