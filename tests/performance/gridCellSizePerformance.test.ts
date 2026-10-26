import { createEncounter } from './actorPackingPerformanceFixtures';
import { updateGridConfiguration } from '@core/movement/updateGridConfiguration';

it('keeps transient cell-size previews fast on expanded snapped maps', () => {
  const state = createEncounter(1);
  state.movementRules.snapToGrid = true;
  state.grid.visible = true;
  for (const value of [6, 3, 1, 0.1]) {
    const start = performance.now();
    const preview = updateGridConfiguration(state, { ...state.grid, cellSize: value });
    expect(performance.now() - start, `cell size ${value}`).toBeLessThan(150);
    expect(preview.grid.cellSize).toBeCloseTo(value);
    expect(preview.actors.byId['actor-0'].currentZoneId).toBe('performance-zone');
    expect(state.grid.cellSize).toBe(64);
  }
});
