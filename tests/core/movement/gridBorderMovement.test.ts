import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { placeSpatialActors, stepSpatialActors } from '@core/movement/movementStrategies';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { refineProfileFit } from '@core/movement/gridDetectionProfiles';

describe('grid borders and proportional Free movement', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('allows Medium actors in every outer square cell in %s', mode => {
    let state = createActor(createEncounterState({ id: 'border', name: 'Border' }), { id: 'a', currentZoneId: 'zoneless' });
    state.movementStrategy = 'grid'; state.validationState.mode = mode;
    state.canvasSize = { width: 640, height: 640 }; state.grid.cellSize = 64;
    state.actors.byId.a.spatialPosition = { x: 160, y: 160 };
    for (let index = 0; index < 10; index++) for (const target of [
      { x: 32, y: index * 64 + 32 }, { x: 608, y: index * 64 + 32 },
      { x: index * 64 + 32, y: 32 }, { x: index * 64 + 32, y: 608 }
    ]) {
      const next = placeSpatialActors(state, { a: target });
      const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('actor.moveSpatial', { actorIds: ['a'] }) });
      expect(prepared.blocked).toBe(false);
      expect(prepared.nextEncounter.actors.byId.a.spatialPosition).toEqual(target);
    }
  });

  it('preserves the fraction of a cell moved after independent background resizing', () => {
    let initial = createActor(createEncounterState({ id: 'scale', name: 'Scale' }), { id: 'a', currentZoneId: 'zoneless' });
    initial.movementStrategy = 'free'; initial.actors.byId.a.spatialPosition = { x: 200, y: 200 };
    for (const cellSize of [16, 32, 64, 128, 256]) {
      const state = { ...initial, grid: { ...initial.grid, cellSize } };
      const next = stepSpatialActors(state, ['a'], { x: 1, y: 0 });
      expect((next.actors.byId.a.spatialPosition!.x - 200) / cellSize).toBeCloseTo(10 / 64);
    }
    const resized = resizeEncounterCanvas(initial, { canvasSize: { width: 480, height: 320 } });
    const before = resized.actors.byId.a.spatialPosition!;
    const after = stepSpatialActors(resized, ['a'], { x: 0, y: 1 }).actors.byId.a.spatialPosition!;
    expect((after.y - before.y) / resized.grid.cellSize).toBeCloseTo(10 / 64);
  });

  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('rejects a partial edge cell when its Medium token would overflow in %s', mode => {
    let state = createActor(createEncounterState({ id: 'partial', name: 'Partial' }), { id: 'a', currentZoneId: 'zoneless' });
    state.movementStrategy = 'grid'; state.validationState.mode = mode;
    state.grid.origin = { x: -8, y: -8 }; state.canvasSize = { width: 256, height: 256 };
    state.actors.byId.a.spatialPosition = { x: 88, y: 88 };
    for (const target of [{ x: 24, y: 88 }, { x: 88, y: 24 }]) {
      const next = placeSpatialActors(state, { a: target });
      expect(prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('actor.moveSpatial', { actorIds: ['a'] }) }).blocked).toBe(true);
    }
  });

  it('refines period and phase to prevent accumulated boundary drift', () => {
    const profile = Array<number>(1000).fill(0);
    for (let point = 1.3; point < profile.length - 1; point += 38.4) {
      const index = Math.floor(point), fraction = point - index;
      profile[index] += 10 * (1 - fraction); profile[index + 1] += 10 * fraction;
    }
    const fit = refineProfileFit(profile, { spacing: 38.5, phase: 1, score: 0.6 });
    expect(fit.spacing).toBeCloseTo(38.4, 1);
    expect(fit.phase).toBeCloseTo(1.3, 0);
  });
});
