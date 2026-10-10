import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { createZone } from '@entities/zone/zoneMutations';
import { completeGridEdges, getGridEdgePadding, completedBoundaryCells } from '@core/movement/gridEdgeCompletion';
import { footprintFits, gridToWorld, spatialActorRadius } from '@core/movement/gridGeometry';
import { resizeEncounterCanvas } from '@core/encounter/canvasSizeMutations';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterHistoryState } from '@core/history/types';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';

function fixture() {
  let state = createZone(createEncounterState({ id: 'edge', name: 'Edge' }), { id: 'z', polygon: [{ x: 60, y: 60 }, { x: 120, y: 60 }, { x: 120, y: 120 }, { x: 60, y: 120 }] });
  state = createActor(state, { id: 'a', currentZoneId: 'zoneless' });
  state.movementStrategy = 'grid'; state.grid.cellSize = 100;
  state.grid.origin = { x: -5, y: -5 }; state.canvasSize = { width: 290, height: 290 };
  state.actors.byId.a.spatialPosition = { x: 145, y: 145 };
  state.backgroundImage = { source: { kind: 'url', url: 'https://example.com/grid.png' }, width: 580, height: 580, name: 'Grid', mediaType: 'image/png' };
  return state;
}

describe('automatic complete grid edges', () => {
  it.each([0.01, 60, 99.99])('completes even a sliver of a cell, with %s%% visible', visible => {
    const state = fixture(); state.grid.origin = { x: visible - 100, y: 0 }; state.canvasSize = { width: visible + 200, height: 300 };
    const padding = getGridEdgePadding(state.grid, state.canvasSize);
    expect(padding.left).toBeCloseTo(100 - visible);
    expect(padding.top + padding.bottom + padding.right).toBe(0);
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('finishes all four edges without changing scale and supports undo/redo in %s', mode => {
    const state = fixture(); state.validationState.mode = mode;
    const next = completeGridEdges(state);
    expect(next.canvasSize).toEqual({ width: 300, height: 300 });
    expect(next.backgroundImage!.frame).toEqual({ x: 5, y: 5, width: 290, height: 290 });
    expect(next.backgroundImage!.width).toBe(580); expect(next.grid.cellSize).toBe(100);
    expect(next.grid.origin).toEqual({ x: 0, y: 0 });
    expect(next.actors.byId.a.spatialPosition).toEqual({ x: 150, y: 150 });
    expect(next.zones.byId.z.polygon[0]).toEqual({ x: 65, y: 65 });
    for (const x of [50, 250]) for (const y of [50, 250])
      expect(footprintFits({ x, y }, spatialActorRadius(next.actors.byId.a, next.grid), next.canvasSize)).toBe(true);
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('grid.completeEdges') });
    expect(prepared.blocked).toBe(false);
    let history = reducer(createEncounterHistoryState(state), commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    history = reducer(history, undoEncounterChange()); expect(history.present).toEqual(state);
    history = reducer(history, redoEncounterChange()); expect(history.present).toEqual(next);
    expect(completeGridEdges(next)).toBe(next);
  });
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('blocks invalid completed-background placement in %s', mode => {
    const state = fixture(); state.validationState.mode = mode;
    const next = completeGridEdges(state); next.backgroundImage!.frame!.x = -1;
    const prepared = prepareValidatedEncounterChange({ currentEncounter: state, nextEncounter: next, action: createEncounterActionRecord('grid.completeEdges') });
    expect(prepared.blocked).toBe(true);
  });
  it('completes small canvases and leaves already complete grids unchanged', () => {
    const state = fixture(); state.canvasSize = { width: 90, height: 90 };
    expect(completeGridEdges(state).canvasSize).toEqual({ width: 100, height: 100 });
    state.grid.origin = { x: 0, y: 0 }; state.canvasSize = { width: 300, height: 300 };
    expect(completeGridEdges(state)).toBe(state);
  });
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('handles rotated %s cells and keeps geometry independent of background scaling', type => {
    const state = fixture(); state.grid.type = type; state.grid.rotation = 17; state.grid.origin = { x: 150, y: 150 };
    const vertices = type === 'square' ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] : Array.from({ length: 6 }, (_, i) => ({ x: 100 / Math.sqrt(3) * Math.cos(i * Math.PI / 3), y: 100 / Math.sqrt(3) * Math.sin(i * Math.PI / 3) }));
    state.canvasSize = { width: Math.max(...vertices.map(p => gridToWorld(state.grid, p).x)) - 1, height: 500 };
    const before = gridToWorld(state.grid, { x: 100, y: 100 });
    const next = completeGridEdges(state), frame = next.backgroundImage!.frame!;
    expect(next.canvasSize.width).toBeGreaterThan(state.canvasSize.width);
    expect(next.canvasSize.height).toBeGreaterThanOrEqual(state.canvasSize.height);
    const after = gridToWorld(next.grid, { x: 100, y: 100 });
    expect(after.x - frame.x).toBeCloseTo(before.x); expect(after.y - frame.y).toBeCloseTo(before.y);
    const scaled = resizeEncounterCanvas(next, { canvasSize: { width: frame.width * 2, height: frame.height * 2 }, zoneScale: 2 });
    expect(scaled.backgroundImage!.frame!.width).toBe(frame.width * 2);
    expect(scaled.grid.cellSize).toBe(next.grid.cellSize);
    const scaledFrame = scaled.backgroundImage!.frame!;
    expect(scaled.grid.origin.x - scaledFrame.x).toBeCloseTo(next.grid.origin.x - frame.x);
    expect(scaled.grid.origin.y - scaledFrame.y).toBeCloseTo(next.grid.origin.y - frame.y);
  });
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('limits each %s margin to one projected cell extent', type => {
    const state = fixture(); state.grid = { ...state.grid, type, rotation: 17 };
    const padding = getGridEdgePadding(state.grid, state.canvasSize);
    const cells = completedBoundaryCells(state.grid, { ...state.canvasSize, x: 0, y: 0 });
    const maxWidth = Math.max(...cells.map(points => Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x))));
    const maxHeight = Math.max(...cells.map(points => Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))));
    expect(padding.left).toBeLessThanOrEqual(maxWidth + 1e-7); expect(padding.right).toBeLessThanOrEqual(maxWidth + 1e-7);
    expect(padding.top).toBeLessThanOrEqual(maxHeight + 1e-7); expect(padding.bottom).toBeLessThanOrEqual(maxHeight + 1e-7);
  });
  it('recalculates against original coverage without accumulating margins, including without a background', () => {
    const state = fixture(); state.backgroundImage = null;
    const first = completeGridEdges(state);
    expect(first.gridCoverage).toEqual({ x: 5, y: 5, width: 290, height: 290 });
    expect(completeGridEdges(first)).toBe(first);
    const larger = completeGridEdges({ ...first, grid: { ...first.grid, cellSize: 120 } });
    expect(larger.canvasSize).toEqual({ width: 360, height: 360 });
    const restored = completeGridEdges({ ...larger, grid: { ...larger.grid, cellSize: 100 } });
    expect(restored.canvasSize).toEqual(first.canvasSize);
    expect(restored.gridCoverage).toEqual(first.gridCoverage);
  });
  it('completes warped edges while retaining their movement transform', () => {
    const state = fixture(); state.grid.warp = { type: 'bilinear', x: [0, 1.1, 0, 0], y: [0, 0, 1.05, 0] };
    state.grid.origin = { x: -2, y: -2 }; state.canvasSize = { width: 326, height: 311 };
    const next = completeGridEdges(state);
    expect(next.grid.warp).toEqual(state.grid.warp);
    expect(next.canvasSize.width).toBeCloseTo(330); expect(next.canvasSize.height).toBeCloseTo(315);
  });
});
