import type { EncounterState } from '@core/encounter/types';
import { ENCOUNTER_SCHEMA_VERSION } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { GRID_SPACING } from '@core/movement/gridScale';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import { getGridCoverage } from '@core/movement/gridCoverage';

/** Uniform conversion preserves lattice addresses and image-relative placements. */
export function migrateGridScale(state: EncounterState): EncounterState {
  const scale = GRID_SPACING / state.grid.cellSize;
  const point = (p: LayoutPoint) => ({ x: p.x * scale, y: p.y * scale });
  const coverage = getGridCoverage(state);
  const frame = { ...point(coverage), width: coverage.width * scale, height: coverage.height * scale };
  const next: EncounterState = { ...state, schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    canvasSize: { width: state.canvasSize.width * scale, height: state.canvasSize.height * scale },
    grid: { ...state.grid, origin: point(state.grid.origin) },
    backgroundImage: state.backgroundImage ? { ...state.backgroundImage, frame } : null,
    gridCoverage: state.gridCoverage ? frame : undefined,
    zones: { ...state.zones, byId: Object.fromEntries(Object.entries(state.zones.byId)
      .map(([id, zone]) => [id, { ...zone, polygon: zone.polygon.map(point) }])) },
    actors: { ...state.actors, byId: Object.fromEntries(Object.entries(state.actors.byId)
      .map(([id, actor]) => [id, actor.spatialPosition ? { ...actor, spatialPosition: point(actor.spatialPosition) } : actor])) }
  };
  return state.movementStrategy === 'grid' || state.grid.visible || state.gridCoverage
    ? completeGridEdges(next) : next;
}
