import { createEncounterState } from '@core/encounter/createEncounterState';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { createEngagement } from '@entities/engagement/engagementMutations';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
import { getGridCoverage } from '@core/movement/gridCoverage';
import { gridToWorld, footprintFits, spatialActorRadius } from '@core/movement/gridGeometry';
import { overflowingSpatialActorIds } from '@core/encounter/backgroundResizeOverflow';
import { clampCanvasResizeToValidLayout, commitCanvasResize, commitBackgroundImage } from '@ui/toolbar/background/backgroundCanvasActions';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEncounterHistoryState } from '@core/history/types';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange, loadEncounterState } from '@store/encounterSlice';
import { store } from '@store/store';
import { setPersistenceWritable } from '@store/persistenceWriteGuardMiddleware';
import { assertEncounterState, parseExportEnvelope } from '@core/persistence/envelope';
import { InMemoryWorkspaceRepository, createEmptyLibraryState } from '@core/persistence/memoryRepository';
import { EXPORT_SCHEMA_VERSION } from '@core/persistence/types';
import { INTERFACE_PREFERENCES_STORAGE_KEY } from '@ui/interface_preferences/InterfacePreferenceProvider';

function fixture() {
  let state = createZone(createEncounterState({ id: 'background', name: 'Background' }), { id: 'z', polygon: [{ x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 }] });
  for (const id of ['inside', 'outside', 'partial']) state = createActor(state, { id, currentZoneId: 'z' });
  state = createEngagement(state, { id: 'g', parentZoneId: 'z', participantIds: ['inside', 'outside'] });
  state.movementStrategy = 'free'; state.grid.visible = true; state.grid.cellSize = 100;
  state.grid.origin = { x: 0, y: 0 };
  state.canvasSize = { width: 600, height: 600 };
  state.backgroundImage = { source: { kind: 'url', url: 'https://example.com/map.png' }, width: 1200, height: 1200, name: 'Map', mediaType: 'image/png', frame: { x: 0, y: 0, width: 600, height: 600 } };
  state.actors.byId.inside.spatialPosition = { x: 150, y: 150 };
  state.actors.byId.outside.spatialPosition = { x: 550, y: 550 };
  state.actors.byId.partial.spatialPosition = { x: 380, y: 250 };
  return state;
}

afterEach(() => { setPersistenceWritable(true); localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY); });

describe('independent background resizing', () => {
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('preserves %s geometry and token size while rebasing completed margins', type => {
    let state = fixture(); state.grid.type = type; state.grid.rotation = 17;
    state.grid.warp = { type: 'bilinear', x: [0, 1.05, 0, 0.0001], y: [0, 0, 1.1, 0.0001] };
    state = completeGridEdges(state);
    const frame = getGridCoverage(state), point = gridToWorld(state.grid, { x: 150, y: 150 });
    const radius = spatialActorRadius(state.actors.byId.inside, state.grid, point);
    const next = resizeEncounterCanvas(state, { canvasSize: { width: 1200, height: 1200 } });
    const nextFrame = getGridCoverage(next), nextPoint = gridToWorld(next.grid, { x: 150, y: 150 });
    expect(next.grid.cellSize).toBe(state.grid.cellSize);
    expect(next.grid.rotation).toBe(state.grid.rotation); expect(next.grid.warp).toEqual(state.grid.warp);
    expect(nextPoint.x - nextFrame.x).toBeCloseTo(point.x - frame.x);
    expect(nextPoint.y - nextFrame.y).toBeCloseTo(point.y - frame.y);
    expect(spatialActorRadius(next.actors.byId.inside, next.grid, nextPoint)).toBeCloseTo(radius);
    for (const id of state.actors.allIds) {
      expect(next.actors.byId[id].spatialPosition!.x - next.grid.origin.x).toBeCloseTo(state.actors.byId[id].spatialPosition!.x - state.grid.origin.x);
      expect(next.actors.byId[id].spatialPosition!.y - next.grid.origin.y).toBeCloseTo(state.actors.byId[id].spatialPosition!.y - state.grid.origin.y);
    }
    const back = resizeEncounterCanvas(next, { canvasSize: { width: 600, height: 600 } });
    expect(back.canvasSize.width).toBeCloseTo(state.canvasSize.width);
    expect(back.canvasSize.height).toBeCloseTo(state.canvasSize.height);
    expect(getGridCoverage(back).x).toBeCloseTo(frame.x);
    expect(getGridCoverage(back).y).toBeCloseTo(frame.y);
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('unplaces only overflowing footprints after completion with exact undo/redo in %s', mode => {
    const state = fixture(); state.validationState.mode = mode;
    const next = resizeEncounterCanvas(state, { canvasSize: { width: 310, height: 310 } });
    expect(next.canvasSize).toEqual({ width: 400, height: 400 });
    expect(next.actors.byId.inside).toEqual(state.actors.byId.inside);
    for (const id of ['outside', 'partial']) {
      const { spatialPosition: _, ...expected } = state.actors.byId[id];
      expect(next.actors.byId[id]).toEqual(expected);
    }
    expect(next.engagements).toBe(state.engagements);
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('canvas.resize') });
    expect(prepared.blocked).toBe(false);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    expect(history.past).toHaveLength(1);
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
  });
  it('keeps an actor in a completed edge cell even when it exceeds background coverage', () => {
    const state = fixture(); state.movementStrategy = 'grid';
    state.actors.byId.partial.spatialPosition = { x: 350, y: 250 };
    const next = resizeEncounterCanvas(state, { canvasSize: { width: 310, height: 310 } });
    expect(next.actors.byId.partial.spatialPosition).toEqual({ x: 350, y: 250 });
    expect(footprintFits({ x: 350, y: 250 }, 45, next.canvasSize)).toBe(true);
  });
  it('applies both policies to saved placements while Zone mode remains active', () => {
    const state = fixture(); state.movementStrategy = 'zone';
    const next = resizeEncounterCanvas(state, { canvasSize: { width: 310, height: 310 } });
    expect(next.actors.byId.outside.spatialPosition).toBeUndefined();
    expect(next.actors.byId.outside.currentZoneId).toBe('z'); expect(next.engagements).toBe(state.engagements);
    const clamped = clampCanvasResizeToValidLayout(state, state, { width: 310, height: 310 }, 310 / 600, 'canvas.resize', 'clamp').encounter;
    expect(overflowingSpatialActorIds(clamped)).toEqual([]);
    expect(clamped.actors).toEqual(state.actors); expect(clamped.grid.cellSize).toBe(100);
    expect(getGridCoverage(clamped).width).toBeGreaterThan(500);
    expect(getGridCoverage(clamped).width).toBeLessThan(502);
  });
  it('round trips resized coverage and unplacements without changing the encounter schema', async () => {
    const before = fixture();
    const resized = resizeEncounterCanvas(before, { canvasSize: { width: 310, height: 310 } });
    expect(resized.schemaVersion).toBe(before.schemaVersion); assertEncounterState(resized);
    const envelope = { kind: 'encounter-export', schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt: 1, encounter: resized, library: createEmptyLibraryState() };
    expect(parseExportEnvelope(JSON.parse(JSON.stringify(envelope)))).toEqual(envelope);
    const repository = new InMemoryWorkspaceRepository();
    const record = await repository.createEncounter(before);
    await repository.saveEncounter(resized, { expectedRevision: record.revision });
    expect((await repository.getEncounter(before.id))!.state).toEqual(resized);
  });
  it('uses the preference for shared background add/replace and blocks read-only writes', () => {
    const state = fixture(); store.dispatch(loadEncounterState(state));
    localStorage.setItem(INTERFACE_PREFERENCES_STORAGE_KEY, JSON.stringify({ backgroundResizeOverflowBehavior: 'clamp' }));
    commitCanvasResize({ actionType: 'canvas.resize', dispatch: store.dispatch, encounter: state, requestedCanvasSize: { width: 310, height: 310 } });
    expect(store.getState().encounter.present.actors).toEqual(state.actors);
    expect(getGridCoverage(store.getState().encounter.present).width).toBeGreaterThan(500);
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    store.dispatch(loadEncounterState(state));
    setPersistenceWritable(false);
    commitCanvasResize({ actionType: 'canvas.resize', dispatch: store.dispatch, encounter: state, requestedCanvasSize: { width: 310, height: 310 } });
    expect(store.getState().encounter.present).toEqual(state);
    setPersistenceWritable(true);
    for (const backgroundImage of [null, state.backgroundImage]) {
      const before = { ...state, backgroundImage }; store.dispatch(loadEncounterState(before));
      commitBackgroundImage({ dispatch: store.dispatch, encounter: before, backgroundImage: state.backgroundImage!, viewportSize: { width: 310, height: 310 }, viewportZoom: 1 });
      const after = store.getState().encounter.present;
      expect(getGridCoverage(after).width).toBe(310); expect(after.grid.cellSize).toBe(100);
      expect(after.actors.byId.inside.spatialPosition).toEqual({ x: 150, y: 150 });
      expect(after.actors.byId.outside.spatialPosition).toBeUndefined();
      expect(store.getState().encounter.past).toHaveLength(1);
      store.dispatch(undoEncounterChange()); expect(store.getState().encounter.present).toEqual(before);
      store.dispatch(redoEncounterChange()); expect(store.getState().encounter.present).toEqual(after);
    }
  });
});
