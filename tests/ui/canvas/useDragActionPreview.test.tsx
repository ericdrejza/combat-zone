import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { useDragActionPreview } from '@ui/canvas/useDragActionPreview';

const baseDrag: ActorDragState = {
  actorId: 'a',
  actorIds: ['a'],
  current: { x: 31, y: 0 },
  hasMoved: true,
  phase: 'dragging',
  start: { x: 0, y: 0 }
};

describe('useDragActionPreview', () => {
  it('previews disengage beyond the tether and engage only after intent matures', () => {
    const dispatch = vi.fn();
    const actor = (id: string) => ({
      actorType: 'creature' as const,
      currentZoneId: 'zone',
      id,
      layoutGroup: 'neutral' as const,
      metadata: {},
      name: id,
      shape: 'circle' as const,
      size: 'small' as const,
      statusEffects: []
    });
    const encounter = {
      ...createEncounterState({ id: 'preview', name: 'Preview' }),
      actors: {
        allIds: ['a', 'b'],
        byId: { a: actor('a'), b: actor('b') }
      },
      engagements: {
        allIds: ['melee'],
        byId: {
          melee: {
            id: 'melee',
            layoutOrientation: 'LEFT_RIGHT' as const,
            layoutStrategy: 'FLEX' as const,
            parentZoneId: 'zone',
            participantIds: ['a', 'b']
          }
        }
      }
    };
    const { rerender } = renderHook(
      ({ drag }: { drag: ActorDragState }) =>
        useDragActionPreview(dispatch, encounter, drag, null),
      { initialProps: { drag: baseDrag } }
    );

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: 'disengage' })
    );

    rerender({ drag: { ...baseDrag } });
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: 'disengage' })
    );

    rerender({
      drag: {
        ...baseDrag,
        engagementIntentActorId: 'target'
      }
    });
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: 'engage' })
    );
  });

  it('previews engage when one engagement token targets another', () => {
    const dispatch = vi.fn();
    const encounter = createEncounterState({ id: 'token', name: 'Token' });

    renderHook(() =>
      useDragActionPreview(dispatch, encounter, null, {
        current: { x: 20, y: 20 },
        engagementId: 'source',
        hasMoved: true,
        hoverTargetEngagementId: 'target',
        phase: 'dragging',
        start: { x: 0, y: 0 }
      })
    );

    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ payload: 'engage' })
    );
  });
});
