import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import { useEngagementDrag } from '@ui/canvas/engagements/useEngagementDrag';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('useEngagementDrag merge validation', () => {
  it('commits a valid token drop into the target engagement', () => {
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
      ...createEncounterState({ id: 'merge', name: 'Merge' }),
      actors: collection(['a', 'b', 'c', 'd'].map(actor)),
      engagements: collection([
        { id: 'source', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const },
        { id: 'target', parentZoneId: 'zone', participantIds: ['c', 'd'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }
      ]),
      zones: collection([{
        id: 'zone',
        colorBorder: '#123456',
        colorFill: '#fff',
        layoutOrientation: 'LEFT_RIGHT' as const,
        layoutStrategy: 'FLEX' as const,
        name: 'Zone',
        namePosition: 'top-left' as const,
        opacity: 1,
        polygon: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 400 },
          { x: 0, y: 400 }
        ],
        shape: 'rectangle' as const,
        showBorder: true,
        showName: false,
        tags: []
      }])
    };
    const placements = [
      { actor: encounter.actors.byId.a!, point: { x: 60, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.b!, point: { x: 120, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.c!, point: { x: 280, y: 220 }, radius: 15 },
      { actor: encounter.actors.byId.d!, point: { x: 400, y: 220 }, radius: 15 }
    ];
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useEngagementDrag(dispatch, encounter, placements)
    );

    act(() => {
      result.current.handleEngagementDragStart('source', { x: 90, y: 100 });
      result.current.handleEngagementDrag({ x: 340, y: 220 });
      result.current.handleEngagementDragEnd();
    });

    const commit = dispatch.mock.calls[0]?.[0];
    expect(commit?.payload.action.type).toBe('engagement.merge');
    expect(commit?.payload.nextEncounter.engagements.allIds).toEqual([
      'target'
    ]);
    expect(
      commit?.payload.nextEncounter.engagements.byId.target.participantIds
    ).toEqual(['c', 'd', 'a', 'b']);
  });
});
