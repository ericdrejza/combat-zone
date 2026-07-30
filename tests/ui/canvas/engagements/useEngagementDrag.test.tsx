import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import { useEngagementDrag } from '@ui/canvas/engagements/useEngagementDrag';

const validationState = vi.hoisted(() => ({ blocked: true }));
vi.mock('@core/validation/validatedEncounterChange', () => ({
  prepareValidatedEncounterChangeForRuntime: (input: {
    action: unknown;
    nextEncounter: unknown;
  }) => ({
    action: input.action,
    blocked: validationState.blocked,
    nextEncounter: input.nextEncounter
  })
}));

function collection<TEntity extends { id: string }>(entities: TEntity[]): EntityCollection<TEntity> {
  return { allIds: entities.map((entity) => entity.id), byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])) };
}

describe('useEngagementDrag', () => {
  it('keeps a failed token drop transiently in a returning state without dispatching history', () => {
    const encounter = {
      ...createEncounterState({ id: 'engagement-drag', name: 'Engagement drag' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'melee', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const placements = [
      { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 }
    ];
    const dispatch = vi.fn();
    const { result } = renderHook(() => useEngagementDrag(dispatch, encounter, placements));

    act(() => {
      result.current.handleEngagementDragStart('melee', { x: 145, y: 100 });
    });
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {
      result.current.handleEngagementDrag({ x: 20, y: 260 });
    });
    act(() => {
      result.current.handleEngagementDragEnd();
    });

    expect(result.current.engagementDrag).toEqual(expect.objectContaining({
      current: { x: 20, y: 260 },
      phase: 'returning'
    }));
    expect(dispatch).not.toHaveBeenCalled();

    act(() => result.current.handleEngagementDragReturnComplete());
    expect(result.current.engagementDrag).toBeNull();
  });

  it('returns after a validation-blocked merge and never commits an encounter history entry', () => {
    const encounter = {
      ...createEncounterState({ id: 'blocked-merge', name: 'Blocked merge' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 360, y: 0 }, { x: 360, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'c', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'C', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'd', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'D', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([
        { id: 'source', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const },
        { id: 'target', parentZoneId: 'zone', participantIds: ['c', 'd'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }
      ])
    };
    const placements = [
      { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.c!, point: { x: 230, y: 220 }, radius: 15 },
      { actor: encounter.actors.byId.d!, point: { x: 330, y: 220 }, radius: 15 }
    ];
    const dispatch = vi.fn();
    const { result } = renderHook(() => useEngagementDrag(dispatch, encounter, placements));

    act(() => result.current.handleEngagementDragStart('source', { x: 145, y: 100 }));
    act(() => result.current.handleEngagementDrag({ x: 280, y: 220 }));
    expect(result.current.engagementDrag).toEqual(expect.objectContaining({
      hoverTargetEngagementId: 'target'
    }));
    act(() => result.current.handleEngagementDragEnd());

    expect(result.current.engagementDrag).toEqual(expect.objectContaining({ phase: 'returning' }));
    // Validation prevented the history commit, and dragging alone does not
    // change selection.
    expect(dispatch).not.toHaveBeenCalled();

    act(() => result.current.handleEngagementDragReturnComplete());
    expect(result.current.engagementDrag).toBeNull();
  });

  it('merges into the target even when start, move, and end share one render frame', () => {
    validationState.blocked = false;
    const encounter = {
      ...createEncounterState({ id: 'merge', name: 'Merge' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'c', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'C', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'd', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'D', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([
        { id: 'source', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const },
        { id: 'target', parentZoneId: 'zone', participantIds: ['c', 'd'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }
      ])
    };
    const placements = [
      { actor: encounter.actors.byId.a!, point: { x: 60, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.b!, point: { x: 120, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.c!, point: { x: 230, y: 200 }, radius: 15 },
      { actor: encounter.actors.byId.d!, point: { x: 350, y: 200 }, radius: 15 }
    ];
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useEngagementDrag(dispatch, encounter, placements)
    );

    act(() => {
      result.current.handleEngagementDragStart('source', { x: 90, y: 100 });
      result.current.handleEngagementDrag({ x: 290, y: 200 });
      result.current.handleEngagementDragEnd();
    });

    const commit = dispatch.mock.calls[0]?.[0];
    expect(commit?.payload.nextEncounter.engagements.allIds).toEqual([
      'target'
    ]);
    expect(
      commit?.payload.nextEncounter.engagements.byId.target.participantIds
    ).toEqual(['c', 'd', 'a', 'b']);
    expect(result.current.engagementDrag).toBeNull();
    validationState.blocked = true;
  });

  it('selects engagement participants only on click and honors toggle modifiers', () => {
    const encounter = {
      ...createEncounterState({ id: 'selection', name: 'Selection' }),
      actors: collection([]),
      engagements: collection([{
        id: 'melee',
        parentZoneId: 'zone',
        participantIds: ['a', 'b'],
        layoutOrientation: 'LEFT_RIGHT' as const,
        layoutStrategy: 'FLEX' as const
      }])
    };
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useEngagementDrag(dispatch, encounter, [])
    );

    act(() => result.current.handleEngagementSelect('melee'));
    act(() => result.current.handleEngagementSelect('melee', true));

    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: {
          entityType: 'actor',
          ids: ['a', 'b'],
          toggle: false
        }
      })
    );
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        payload: {
          entityType: 'actor',
          ids: ['a', 'b'],
          toggle: true
        }
      })
    );
  });
});
