import { describe, expect, it } from 'vitest';
import { updateActorDragPoint } from '@ui/canvas/handlers/actorDragHelpers';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

function dragging(): ActorDragState {
  return { actorId: 'a', actorIds: ['a'], phase: 'dragging', hasMoved: true,
    start: { x: 64, y: 64 }, current: { x: 128, y: 96 }, waypoints: [{ x: 100, y: 80 }] };
}

describe('actor drag point updates', () => {
  it('preserves state for repeated Motion callbacks at the same point after a pivot', () => {
    const drag = dragging();
    let next: ActorDragState | null = drag;
    for (let i = 0; i < 100; i++) next = updateActorDragPoint(next, { ...drag.current }, {});
    expect(next).toBe(drag);
    expect(next?.waypoints).toEqual([{ x: 100, y: 80 }]);
  });

  it('continues moving after a pivot without changing its fixed segments', () => {
    const drag = dragging();
    const next = updateActorDragPoint(drag, { x: 160, y: 140 }, {});
    expect(next?.current).toEqual({ x: 160, y: 140 });
    expect(next?.waypoints).toBe(drag.waypoints);
    expect(drag.current).toEqual({ x: 128, y: 96 });
  });

  it('clears a changed engagement intent even when the pointer has not moved', () => {
    const drag = { ...dragging(), engagementIntentActorId: 'other' };
    const next = updateActorDragPoint(drag, drag.current, {});
    expect(next?.engagementIntentActorId).toBeUndefined();
    expect(updateActorDragPoint(next, drag.current, {})).toBe(next);
    expect(updateActorDragPoint(drag, drag.current, { actorId: 'other' })).toBe(drag);
  });

  it('records the first meaningful movement and never recreates a cancelled drag', () => {
    const drag = { ...dragging(), hasMoved: false };
    expect(updateActorDragPoint(drag, drag.current, {})?.hasMoved).toBe(true);
    expect(updateActorDragPoint(null, drag.current, {})).toBeNull();
  });

  it.each(['validating', 'returning'] as const)('ignores callbacks after the drag enters %s', phase => {
    const drag = { ...dragging(), phase };
    expect(updateActorDragPoint(drag, { x: 500, y: 400 }, {})).toBe(drag);
  });
});
