import { describe, expect, it } from 'vitest';

import {
  calculateEngagementLayout,
  calculateZoneLayout
} from '@core/layout/encounterLayout';
import {
  createLayoutEncounterState,
  enemyActor,
  heroActor,
  objectiveActor
} from './layoutTestSupport';

describe('layout strategies', () => {
  it('splits heroes, enemies, and neutral actors left-to-right', () => {
    const state = createLayoutEncounterState();

    expect(calculateZoneLayout(state, 'zone-battlefield').descriptor).toEqual({
      strategy: 'SPLIT_SEQUENTIAL',
      orientation: 'LEFT_RIGHT',
      className:
        'cz-layout cz-layout-split-sequential cz-layout-orientation-left-right',
      sections: [
        {
          id: 'hero',
          className: 'cz-layout-section-hero',
          items: [{ id: 'actor-second-hero', layoutGroup: 'hero' }]
        },
        {
          id: 'engagement-engagement-melee',
          className: 'cz-layout-section-engagement-engagement-melee',
          items: [
            { id: 'engagement-melee', layoutGroup: 'neutral' },
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' }
          ]
        },
        {
          id: 'neutral',
          className: 'cz-layout-section-neutral',
          items: [{ id: 'actor-objective', layoutGroup: 'neutral' }]
        },
        {
          id: 'enemy',
          className: 'cz-layout-section-enemy',
          items: []
        }
      ]
    });
  });

  it('supports split flex grouping with flex-specific strategy metadata', () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: 'SPLIT_FLEX'
      }
    });

    expect(calculateZoneLayout(state, 'zone-battlefield').descriptor).toEqual({
      strategy: 'SPLIT_FLEX',
      orientation: 'LEFT_RIGHT',
      className:
        'cz-layout cz-layout-split-flex cz-layout-orientation-left-right',
      sections: [
        {
          id: 'hero',
          className: 'cz-layout-section-hero cz-layout-section-flex',
          items: [{ id: 'actor-second-hero', layoutGroup: 'hero' }]
        },
        {
          id: 'engagement-engagement-melee',
          className:
            'cz-layout-section-engagement-engagement-melee cz-layout-section-flex',
          items: [
            { id: 'engagement-melee', layoutGroup: 'neutral' },
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' }
          ]
        },
        {
          id: 'neutral',
          className: 'cz-layout-section-neutral cz-layout-section-flex',
          items: [{ id: 'actor-objective', layoutGroup: 'neutral' }]
        },
        {
          id: 'enemy',
          className: 'cz-layout-section-enemy cz-layout-section-flex',
          items: []
        }
      ]
    });
  });

  it('splits heroes, enemies, and neutral actors top-to-bottom', () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutOrientation: 'TOP_BOTTOM'
      }
    });

    expect(
      calculateZoneLayout(state, 'zone-battlefield').descriptor
    ).toMatchObject({
      strategy: 'SPLIT_SEQUENTIAL',
      orientation: 'TOP_BOTTOM',
      className:
        'cz-layout cz-layout-split-sequential cz-layout-orientation-top-bottom'
    });
  });

  it('calculates engagement participant layout from participant membership and actor collection order', () => {
    const state = createLayoutEncounterState({
      actors: [enemyActor, objectiveActor, heroActor]
    });

    expect(
      calculateEngagementLayout(state, 'engagement-melee').descriptor
    ).toEqual({
      strategy: 'SEQUENTIAL',
      orientation: 'TOP_BOTTOM',
      className:
        'cz-layout cz-layout-sequential cz-layout-orientation-top-bottom',
      sections: [
        {
          id: 'all',
          className: 'cz-layout-section-all',
          items: [
            { id: 'actor-enemy', layoutGroup: 'enemy' },
            { id: 'actor-hero', layoutGroup: 'hero' }
          ]
        }
      ]
    });
  });
});
