import type { EncounterState } from '@core/encounter/types';
import type { GridConfiguration } from './types';
import { completeGridEdges } from './gridEdgeCompletion';
import { resnapSpatialActors } from './movementStrategies';
/** Alignment, canvas completion, and actor snapping are one reversible operation. */
export function updateGridConfiguration(state: EncounterState, grid: GridConfiguration) {
  return resnapSpatialActors(completeGridEdges({ ...state, grid }));
}
