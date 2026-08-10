import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import {
  circleZone,
  collection,
  expectPackedPlacements,
  zone,
  zonedActor,
  MINIMUM_ACTOR_GAP
} from './actorCanvasLayoutTestSupport';

describe('actor canvas layout', () => {
  it('lays split sections vertically for LEFT_RIGHT and horizontally for TOP_BOTTOM', () => {
    const zoneId = 'split-zone';
    const actors = [
      { ...zonedActor('hero-one', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('hero-two', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('enemy', zoneId), layoutGroup: 'enemy' as const }
    ];
    const leftRightEncounter = {
      ...createEncounterState({
        id: 'encounter-split-left-right',
        name: 'Split'
      }),
      actors: collection(actors),
      zones: collection([
        {
          ...zone(zoneId, 100, 100, 300, 200),
          layoutStrategy: 'SPLIT_FLEX' as const,
          layoutOrientation: 'LEFT_RIGHT' as const
        }
      ])
    };
    const topBottomEncounter = {
      ...leftRightEncounter,
      zones: collection([
        {
          ...leftRightEncounter.zones.byId[zoneId]!,
          layoutOrientation: 'TOP_BOTTOM' as const
        }
      ])
    };

    const leftRight = getActorRenderPlacements(leftRightEncounter);
    const topBottom = getActorRenderPlacements(topBottomEncounter);
    expect(leftRight[0].point.x).toBeLessThan(leftRight[2].point.x);
    expect(leftRight[1].point.x).toBeLessThan(leftRight[2].point.x);
    expect(topBottom[0].point.y).toBeLessThan(topBottom[2].point.y);
    expect(topBottom[1].point.y).toBeLessThan(topBottom[2].point.y);
    expectPackedPlacements(
      leftRight,
      leftRightEncounter.zones.byId[zoneId]!.polygon,
      MINIMUM_ACTOR_GAP
    );
    expectPackedPlacements(
      topBottom,
      topBottomEncounter.zones.byId[zoneId]!.polygon,
      MINIMUM_ACTOR_GAP
    );
  });

  it('centers SPLIT_SEQUENTIAL faction rows on the orientation cross-axis', () => {
    const zoneId = 'split-sequential-circle';
    const actors = [
      { ...zonedActor('hero-one', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('hero-two', zoneId), layoutGroup: 'hero' as const },
      { ...zonedActor('enemy-one', zoneId), layoutGroup: 'enemy' as const },
      { ...zonedActor('enemy-two', zoneId), layoutGroup: 'enemy' as const }
    ];
    const leftRightZone = circleZone(
      zoneId,
      100,
      100,
      300,
      300,
      'SPLIT_SEQUENTIAL'
    );
    const leftRightEncounter = {
      ...createEncounterState({
        id: 'encounter-split-sequential-axis',
        name: 'Split Sequential'
      }),
      actors: collection(actors),
      zones: collection([leftRightZone])
    };
    const topBottomEncounter = {
      ...leftRightEncounter,
      zones: collection([
        {
          ...leftRightZone,
          layoutOrientation: 'TOP_BOTTOM' as const
        }
      ])
    };

    const leftRight = getActorRenderPlacements(leftRightEncounter);
    const topBottom = getActorRenderPlacements(topBottomEncounter);
    const leftRightHeroes = leftRight.filter(
      ({ actor }) => actor.layoutGroup === 'hero'
    );
    const topBottomHeroes = topBottom.filter(
      ({ actor }) => actor.layoutGroup === 'hero'
    );

    expect(
      leftRightHeroes.reduce((total, { point }) => total + point.y, 0) /
        leftRightHeroes.length
    ).toBeCloseTo(250, 5);
    expect(
      topBottomHeroes.reduce((total, { point }) => total + point.x, 0) /
        topBottomHeroes.length
    ).toBeCloseTo(250, 5);
    expectPackedPlacements(leftRight, leftRightZone.polygon);
    expectPackedPlacements(topBottom, leftRightZone.polygon);
  });
});
