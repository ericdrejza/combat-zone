import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { Zone } from '@entities/zone/types';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import { cacheActorRenderPlacementsForZoneMove } from '@ui/canvas/actors/actorPlacementTranslation';
import {
  clearProactiveActorPlacementCache,
  getProactivePlanCount,
  scheduleProactiveActorPlacementComputations
} from '@ui/canvas/actors/proactiveActorPlacementCache';
import {
  actor,
  collection,
  zone,
  zonedActor,
  POLYGON_LAYOUT_SETTINGS
} from './actorCanvasLayoutTestSupport';

describe('actor canvas layout', () => {
  it('does not include zoneless actors in canvas placements', () => {
    const encounter = {
      ...createEncounterState({
        id: 'encounter-zoneless-layout',
        name: 'Zoneless Layout'
      }),
      actors: collection([actor('actor-zoneless')])
    };

    expect(getActorRenderPlacements(encounter)).toEqual([]);
  });

  it('reuses geometry for visual-only actor edits while rendering the latest actor', () => {
    const zoneId = 'rectangle-zone';
    const encounter = {
      ...createEncounterState({ id: 'encounter-cache', name: 'Cache' }),
      actors: collection([zonedActor('actor-cache', zoneId)]),
      zones: collection([zone(zoneId, 100, 100, 300, 300)])
    };
    const initialPlacement = getActorRenderPlacements(encounter)[0];
    const updatedActor = {
      ...encounter.actors.byId['actor-cache']!,
      image: 'data:image/png;base64,updated',
      name: 'Updated actor'
    };
    const updatedEncounter = {
      ...encounter,
      actors: collection([updatedActor])
    };

    const updatedPlacement = getActorRenderPlacements(updatedEncounter)[0];

    expect(updatedPlacement.actor).toBe(updatedActor);
    expect(updatedPlacement.point).toEqual(initialPlacement.point);
  });

  it('reuses translated geometry when a zone moves', () => {
    const zoneId = 'translated-zone';
    const encounter = {
      ...createEncounterState({
        id: 'encounter-zone-move-cache',
        name: 'Cache'
      }),
      actors: collection([
        zonedActor('actor-one', zoneId),
        zonedActor('actor-two', zoneId)
      ]),
      engagements: collection([
        {
          id: 'translated-engagement',
          layoutOrientation: 'LEFT_RIGHT' as const,
          layoutStrategy: 'FLEX' as const,
          parentZoneId: zoneId,
          participantIds: ['actor-one', 'actor-two']
        }
      ]),
      zones: collection([zone(zoneId, 100, 100, 300, 300)])
    };
    const placements = getActorRenderPlacements(encounter);
    const offset = { x: 75, y: -30 };
    const movedZone = zone(zoneId, 175, 70, 300, 300);
    const movedEncounter = {
      ...encounter,
      zones: collection([movedZone])
    };

    cacheActorRenderPlacementsForZoneMove(
      movedEncounter,
      placements,
      zoneId,
      offset
    );

    const movedPlacements = getActorRenderPlacements(movedEncounter);

    expect(movedPlacements.map(({ point }) => point)).toEqual(
      placements.map(({ point }) => ({
        x: point.x + offset.x,
        y: point.y + offset.y
      }))
    );
    expect(movedPlacements[0].engagementTokenPoint).toEqual({
      x: placements[0].engagementTokenPoint!.x + offset.x,
      y: placements[0].engagementTokenPoint!.y + offset.y
    });
  });

  it('uses an asynchronously precomputed non-split configuration for a new actor', async () => {
    vi.useFakeTimers();
    clearProactiveActorPlacementCache();

    try {
      const zoneId = 'proactive-zone';
      const selectedZone = zone(zoneId, 100, 100, 500, 500);
      const existingActor = zonedActor('existing', zoneId);
      const baseEncounter = {
        ...createEncounterState({
          id: 'encounter-proactive',
          name: 'Proactive'
        }),
        actors: collection([existingActor]),
        zones: collection([selectedZone])
      };
      const plannedPointCalculator = (
        _zone: Zone,
        actors: { id: string; radius: number }[]
      ) =>
        actors.map((plannedActor, index) => ({
          actorId: plannedActor.id,
          point: { x: 100 + index * 100, y: 200 },
          radius: plannedActor.radius
        }));

      scheduleProactiveActorPlacementComputations(
        baseEncounter,
        POLYGON_LAYOUT_SETTINGS,
        plannedPointCalculator
      );
      await vi.runAllTimersAsync();

      expect(getProactivePlanCount()).toBe(8);

      const incomingActor = zonedActor('incoming', zoneId);
      const nextEncounter = {
        ...baseEncounter,
        actors: collection([existingActor, incomingActor])
      };
      const plannedPlacements = getActorRenderPlacements(
        nextEncounter,
        'PROACTIVE'
      );

      expect(getProactivePlanCount()).toBe(8);
      expect(plannedPlacements).toHaveLength(2);
      expect(plannedPlacements.map(({ actor: current }) => current.id)).toEqual([
        existingActor.id,
        incomingActor.id
      ]);
      expect(plannedPlacements.map(({ point }) => point)).toEqual([
        { x: 100, y: 200 },
        { x: 200, y: 200 }
      ]);
    } finally {
      clearProactiveActorPlacementCache();
      vi.useRealTimers();
    }
  });
});
