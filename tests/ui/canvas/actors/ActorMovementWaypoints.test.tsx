import { act, fireEvent, renderHook } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { useActorMovementWaypoints } from '@ui/canvas/actors/useActorMovementWaypoints';
import type { ActorDragState, CanvasInteractionState } from '@ui/canvas/canvasInteractionTypes';

it('recognizes the same gesture across immutable pointer updates but rejects cancellation and replacement', () => {
  const encounter = createEncounterState({ id: 'map', name: 'Map' }); encounter.movementRules.zoneLocked = false;
  const setActorDrag = vi.fn();
  const input = { activeToolId: 'grid', encounter, actorDrag: null, setActorDrag } as unknown as CanvasInteractionState;
  const { result, rerender } = renderHook(props => useActorMovementWaypoints(props), { initialProps: input });
  const drag: ActorDragState = { actorId: 'a', actorIds: ['a'], current: { x: 100, y: 100 }, start: { x: 64, y: 64 }, hasMoved: true, phase: 'dragging' };
  rerender({ ...input, actorDrag: drag });
  expect(result.current(drag)).toBe(true);
  rerender({ ...input, actorDrag: { ...drag, current: { x: 128, y: 128 } } });
  expect(result.current(drag)).toBe(true);
  act(() => fireEvent.keyDown(window, { key: 'Escape' }));
  expect(result.current(drag)).toBe(false);
  rerender({ ...input, actorDrag: { ...drag, start: { ...drag.start } } });
  expect(result.current(drag)).toBe(false);
});

it('adds one pivot per Shift press and preserves earlier pivots as the drag continues', () => {
  const encounter = createEncounterState({ id: 'map', name: 'Map' }); encounter.movementRules.zoneLocked = false;
  let drag: ActorDragState | null = null;
  const setActorDrag = vi.fn(next => { drag = typeof next === 'function' ? next(drag) : next; });
  const input = { activeToolId: 'select', encounter, actorDrag: null, setActorDrag } as unknown as CanvasInteractionState;
  const { rerender } = renderHook(props => useActorMovementWaypoints(props), { initialProps: input });
  drag = { actorId: 'a', actorIds: ['a'], current: { x: 128, y: 64 }, start: { x: 64, y: 64 }, hasMoved: true, phase: 'dragging' };
  rerender({ ...input, actorDrag: drag });
  act(() => fireEvent.keyDown(window, { key: 'Shift' }));
  expect(drag!.waypoints).toEqual([{ x: 128, y: 64 }]);
  act(() => fireEvent.keyDown(window, { key: 'Shift', repeat: true }));
  expect(drag!.waypoints).toHaveLength(1);
  drag = { ...drag!, current: { x: 128, y: 192 } };
  rerender({ ...input, actorDrag: drag });
  act(() => fireEvent.keyDown(window, { key: 'Shift' }));
  expect(drag!.waypoints).toEqual([{ x: 128, y: 64 }, { x: 128, y: 192 }]);
});
