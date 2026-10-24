import { act, fireEvent, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { useActorMovementWaypoints } from '@ui/canvas/actors/useActorMovementWaypoints';
import type { ActorDragState, CanvasInteractionState } from '@ui/canvas/canvasInteractionTypes';

it('backtracks pivoted movement without moving or ending the active drag', () => {
  const encounter = createEncounterState({ id: 'map', name: 'Map' });
  encounter.movementRules.zoneLocked = false;
  const { result } = renderHook(() => {
    const [drag, setActorDrag] = useState<ActorDragState | null>(null);
    useActorMovementWaypoints({ activeToolId: 'select', encounter, actorDrag: drag, setActorDrag } as CanvasInteractionState);
    return { drag, setActorDrag };
  });
  const first = { x: 128, y: 64 }, second = { x: 128, y: 192 };
  const initial: ActorDragState = { actorId: 'a', actorIds: ['a'], start: { x: 64, y: 64 },
    current: { x: 192, y: 192 }, waypoints: [first, second], hasMoved: true, phase: 'dragging' };
  act(() => result.current.setActorDrag(initial));
  const context = () => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    act(() => window.dispatchEvent(event));
    return event;
  };
  expect(context().defaultPrevented).toBe(true);
  expect(result.current.drag).toEqual({ ...initial, waypoints: [first] });
  context();
  expect(result.current.drag).toEqual({ ...initial, waypoints: [] });
  const direct = result.current.drag;
  context();
  expect(result.current.drag).toBe(direct);
  act(() => fireEvent.keyDown(window, { code: 'Space' }));
  expect(result.current.drag!.waypoints).toEqual([initial.current]);
  act(() => result.current.setActorDrag({ ...initial, phase: 'validating' }));
  expect(context().defaultPrevented).toBe(false);
  expect(result.current.drag!.waypoints).toEqual([first, second]);
  act(() => result.current.setActorDrag(null));
  expect(context().defaultPrevented).toBe(false);
});

it('leaves context actions alone during zone-locked movement', () => {
  const encounter = createEncounterState({ id: 'map', name: 'Map' });
  encounter.movementRules.zoneLocked = true;
  const setActorDrag = vi.fn();
  const input = { activeToolId: 'select', encounter, actorDrag: null, setActorDrag } as unknown as CanvasInteractionState;
  const { rerender } = renderHook(props => useActorMovementWaypoints(props), { initialProps: input });
  rerender({ ...input, actorDrag: { actorId: 'a', actorIds: ['a'], start: { x: 0, y: 0 }, current: { x: 100, y: 100 }, phase: 'dragging', hasMoved: true, waypoints: [{ x: 50, y: 50 }] } });
  setActorDrag.mockClear();
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
  act(() => window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  expect(setActorDrag).not.toHaveBeenCalled();
});

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
