import { ZoneIntegrityValidator } from '@core/validation/zoneIntegrityValidator';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { getActorRadius } from '@core/layout/actorFootprints';
import { updateGridConfiguration, applyGridAlignment } from '@core/movement/updateGridConfiguration';
import { resolveGridGeometry } from '@core/movement/gridScale';
import { gridToWorld, spatialActorRadius } from '@core/movement/gridGeometry';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { changeMovementStrategy, spatialPlacements } from '@core/movement/movementStrategies';
import { createEncounterHistoryState } from '@core/history/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import type { GridConfiguration } from '@core/movement/types';

function fixture() {
  const state = createActor(createEncounterState({ id: 'scale', name: 'Scale' }), { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = 'free';
  state.actors.byId.a.spatialPosition = { x: 160, y: 160 };
  return state;
}

describe('shared map scale and stable actor footprints', () => {
  it.each(['small', 'medium', 'large', 'xLarge'] as const)('keeps %s footprints across strategies, sizing, and warped regions', size => {
    let state = fixture(); state.actors.byId.a.size = size;
    const expected = getActorRadius(state.actors.byId.a);
    for (const strategy of ['zone', 'grid', 'free'] as const) {
      state = changeMovementStrategy(state, strategy, {});
      expect(spatialActorRadius(state.actors.byId.a, state.grid)).toBe(expected);
      if (strategy !== 'zone') expect(spatialPlacements(state)[0].radius).toBe(expected);
    }
    state.grid.warp = { type: 'bilinear', x: [0, 1.2, 0, 0.001], y: [0, 0, 0.9, 0.002] };
    for (const point of [{ x: 160, y: 160 }, { x: 600, y: 400 }])
      expect(spatialActorRadius(state.actors.byId.a, state.grid, point)).toBe(expected);
    const enlarged = updateGridConfiguration(state, { ...state.grid, cellSize: 32 });
    expect(spatialPlacements(enlarged)[0].radius).toBe(expected);
  });

  it('halves the scale value by doubling map coverage and Zones, retaining actor coordinates', () => {
    const state = createZone(fixture(), { id: 'z', polygon: [{ x: 10, y: 10 }, { x: 310, y: 10 }, { x: 310, y: 310 }, { x: 10, y: 310 }] });
    const next = updateGridConfiguration(state, { ...state.grid, cellSize: 32 });
    expect(getGridCoverage(next)).toMatchObject({ width: 1920, height: 1280 });
    expect(next.grid.cellSize).toBe(32);
    expect(resolveGridGeometry(next.grid).cellSize).toBe(64);
    expect(next.zones.byId.z.polygon[0]).toEqual({ x: 20, y: 20 });
    expect(next.actors.byId.a.spatialPosition).toEqual(state.actors.byId.a.spatialPosition);
    const back = updateGridConfiguration(next, { ...next.grid, cellSize: 64 });
    expect(getGridCoverage(back)).toMatchObject({ width: 960, height: 640 });
    expect(back.zones).toEqual(state.zones);
    const viaBackground = resizeEncounterCanvas(state, { canvasSize: { width: 1920, height: 1280 } });
    expect(viaBackground.grid.cellSize).toBe(next.grid.cellSize);
  });

  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('commits sizing and overflow in one exact history entry in %s', mode => {
    const state = fixture(); state.validationState.mode = mode;
    state.actors.byId.a.spatialPosition = { x: 800, y: 500 };
    const next = updateGridConfiguration(state, { ...state.grid, cellSize: 128 });
    expect(next.actors.byId.a.spatialPosition).toBeUndefined();
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('grid.update') });
    expect(prepared.blocked).toBe(false);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.past).toHaveLength(1);
    const saved = history.present;
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(saved);
    const clamped = updateGridConfiguration(state, { ...state.grid, cellSize: 128 }, 'clamp');
    expect(clamped.actors.byId.a.spatialPosition).toEqual(state.actors.byId.a.spatialPosition);
    expect(clamped.grid.cellSize).toBeLessThan(128);
  });

  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('normalizes fitted %s geometry with the map while keeping actors fixed', type => {
    const state = fixture(), frame = getGridCoverage(state);
    const fitted: GridConfiguration = { ...state.grid, type, cellSize: 32, rotation: 17, origin: { x: 70, y: 90 },
      warp: { type: 'bilinear', x: [0, 1, 0, 0.0001], y: [0, 0, 1, 0.0002] } };
    const before = gridToWorld(fitted, { x: 64, y: 96 });
    const next = applyGridAlignment(state, fitted), afterFrame = getGridCoverage(next);
    const after = gridToWorld(resolveGridGeometry(next.grid), { x: 128, y: 192 });
    expect(afterFrame.width).toBe(frame.width * 2);
    expect(after.x - afterFrame.x).toBeCloseTo((before.x - frame.x) * 2);
    expect(after.y - afterFrame.y).toBeCloseTo((before.y - frame.y) * 2);
    expect(next.grid.cellSize).toBe(32); expect(next.grid.warp).toEqual(fitted.warp);
    expect(next.actors.byId.a.spatialPosition!.x - afterFrame.x).toBeCloseTo(160);
    expect(next.actors.byId.a.spatialPosition!.y - afterFrame.y).toBeCloseTo(160);
  });
});

it.each(['ADVISORY', 'STRICT'] as const)('retains semantic validation behavior for map sizing in %s', mode => {
  const state = fixture(); state.movementStrategy = 'zone'; state.validationState.mode = mode;
  state.actors.byId.a.currentZoneId = 'missing-zone';
  const next = resizeEncounterCanvas(state, { canvasSize: { width: 1920, height: 1280 } });
  const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next,
    action: createEncounterActionRecord('grid.update'), validators: [ZoneIntegrityValidator] });
  expect(prepared.validationResult.messages).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'zoneIntegrity.actorZoneMissing' })]));
  expect(prepared.blocked).toBe(mode === 'STRICT');
});

it('rejects exact alignment below Zone layout limits without changing the encounter', () => {
  let state = createZone(fixture(), { id: 'z', polygon: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }] });
  state.movementStrategy = 'zone'; state.actors.byId.a.currentZoneId = 'z'; state.actors.byId.a.size = 'xLarge';
  const before = structuredClone(state);
  const result = applyGridAlignment(state, { ...resolveGridGeometry(state.grid), cellSize: 640 });
  expect(result).toBe(state); expect(state).toEqual(before);
});

it('rejects alignment requiring actor overflow when the preference retains placements', () => {
  const state = fixture(); state.actors.byId.a.spatialPosition = { x: 800, y: 500 };
  expect(applyGridAlignment(state, { ...resolveGridGeometry(state.grid), cellSize: 128 }, 'clamp')).toBe(state);
});
