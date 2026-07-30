import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ENGAGEMENT_INTENT_DELAY_MS, useEngagementHoverIntent } from '@ui/canvas/engagements/useEngagementHoverIntent';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

const actor = (id: string) => ({ id, actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'neutral' as const, metadata: {}, name: id, shape: 'circle' as const, size: 'small' as const, statusEffects: [] });
const drag: ActorDragState = { actorId: 'a', actorIds: ['a'], current: { x: 0, y: 0 }, hasMoved: true, phase: 'dragging', start: { x: 0, y: 0 } };

describe('useEngagementHoverIntent', () => {
  it('sets intent only after 500ms and cancels when the target changes', () => {
    vi.useFakeTimers();
    const encounter = { ...createEncounterState({ id: 'test', name: 'Test' }), actors: { allIds: ['a', 'b', 'c'], byId: { a: actor('a'), b: actor('b'), c: actor('c') } } };
    let current: ActorDragState | null = drag;
    const setDrag = (update: ActorDragState | null | ((value: ActorDragState | null) => ActorDragState | null)) => {
      current = typeof update === 'function' ? update(current) : update;
    };
    const placements = [
      { actor: encounter.actors.byId.a, point: { x: 0, y: 0 }, radius: 10 },
      { actor: encounter.actors.byId.b, point: { x: 50, y: 0 }, radius: 10 },
      { actor: encounter.actors.byId.c, point: { x: 100, y: 0 }, radius: 10 }
    ];
    const { result } = renderHook(() => useEngagementHoverIntent(encounter, placements, setDrag));
    act(() => result.current.updateIntent(drag, { x: 50, y: 0 }));
    act(() => vi.advanceTimersByTime(ENGAGEMENT_INTENT_DELAY_MS - 100));
    // Continuous motion inside the same token does not restart the hold.
    act(() => result.current.updateIntent(drag, { x: 50, y: 0 }));
    act(() => vi.advanceTimersByTime(99));
    expect(current?.engagementIntentActorId).toBeUndefined();
    act(() => result.current.updateIntent(drag, { x: 100, y: 0 }));
    act(() => vi.advanceTimersByTime(ENGAGEMENT_INTENT_DELAY_MS));
    expect(current?.engagementIntentActorId).toBe('c');
    vi.useRealTimers();
  });

  it('does not restart the continuous hold for repeated events over one actor', () => {
    vi.useFakeTimers();
    const encounter = { ...createEncounterState({ id: 'repeat', name: 'Repeat' }), actors: { allIds: ['a', 'b'], byId: { a: actor('a'), b: actor('b') } } };
    let current: ActorDragState | null = drag;
    const setDrag = (update: ActorDragState | null | ((value: ActorDragState | null) => ActorDragState | null)) => { current = typeof update === 'function' ? update(current) : update; };
    const placements = [{ actor: encounter.actors.byId.a, point: { x: 0, y: 0 }, radius: 10 }, { actor: encounter.actors.byId.b, point: { x: 50, y: 0 }, radius: 10 }];
    const { result } = renderHook(() => useEngagementHoverIntent(encounter, placements, setDrag));
    act(() => result.current.updateIntent(drag, { x: 50, y: 0 }));
    act(() => vi.advanceTimersByTime(400));
    act(() => result.current.updateIntent(drag, { x: 50, y: 0 }));
    act(() => vi.advanceTimersByTime(100));
    expect(current?.engagementIntentActorId).toBe('b');
    vi.useRealTimers();
  });

  it('uses the same 500ms intent delay for an actor in an existing engagement', () => {
    vi.useFakeTimers();
    const encounter = {
      ...createEncounterState({ id: 'existing', name: 'Existing' }),
      actors: {
        allIds: ['a', 'b', 'c'],
        byId: { a: actor('a'), b: actor('b'), c: actor('c') }
      },
      engagements: {
        allIds: ['melee'],
        byId: {
          melee: {
            id: 'melee',
            layoutOrientation: 'LEFT_RIGHT' as const,
            layoutStrategy: 'FLEX' as const,
            parentZoneId: 'zone',
            participantIds: ['b', 'c']
          }
        }
      }
    };
    let current: ActorDragState | null = drag;
    const setDrag = (update: ActorDragState | null | ((value: ActorDragState | null) => ActorDragState | null)) => {
      current = typeof update === 'function' ? update(current) : update;
    };
    const placements = [
      { actor: encounter.actors.byId.a, point: { x: 0, y: 0 }, radius: 10 },
      { actor: encounter.actors.byId.b, point: { x: 50, y: 0 }, radius: 10 },
      { actor: encounter.actors.byId.c, point: { x: 100, y: 0 }, radius: 10 }
    ];
    const { result } = renderHook(() =>
      useEngagementHoverIntent(encounter, placements, setDrag)
    );

    act(() => result.current.updateIntent(drag, { x: 50, y: 0 }));
    act(() => vi.advanceTimersByTime(ENGAGEMENT_INTENT_DELAY_MS - 1));
    expect(current?.engagementIntentEngagementId).toBeUndefined();
    act(() => vi.advanceTimersByTime(1));
    expect(current?.engagementIntentEngagementId).toBe('melee');
    expect(current?.engagementIntentActorId).toBeUndefined();
    vi.useRealTimers();
  });
});
