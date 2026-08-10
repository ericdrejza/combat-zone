import { describe, expect, it } from 'vitest';

import {
  calculateZoneLayout
} from '@core/layout/encounterLayout';
import { getLayoutStrategy } from '@core/layout/strategies';
import {
  createLayoutEncounterState,
  enemyActor,
  heroActor,
  objectiveActor
} from './layoutTestSupport';

describe('layout strategies', () => {
  it('registers shared pluggable strategies', () => {
    expect(getLayoutStrategy('FLEX').id).toBe('FLEX');
    expect(getLayoutStrategy('SEQUENTIAL').id).toBe('SEQUENTIAL');
    expect(getLayoutStrategy('SPLIT_FLEX').id).toBe('SPLIT_FLEX');
    expect(getLayoutStrategy('SPLIT_SEQUENTIAL').id).toBe('SPLIT_SEQUENTIAL');
  });

  it('describes deterministic FLEX layout without calculating actor positions', () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: 'FLEX'
      },
      actors: [heroActor, enemyActor]
    });
    const firstLayout = calculateZoneLayout(state, 'zone-battlefield');
    const secondLayout = calculateZoneLayout(state, 'zone-battlefield');

    expect(firstLayout).toEqual(secondLayout);
    expect(firstLayout.descriptor).toEqual({
      strategy: 'FLEX',
      orientation: 'LEFT_RIGHT',
      className: 'cz-layout cz-layout-flex cz-layout-orientation-left-right',
      sections: [
        {
          id: 'all',
          className: 'cz-layout-section-all',
          items: [
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' },
            { id: 'engagement-melee', layoutGroup: 'neutral' }
          ]
        }
      ]
    });
    expect(state.actors.byId['actor-hero']).not.toHaveProperty('position');
  });

  it('uses allIds collection order for SEQUENTIAL layout items', () => {
    const state = createLayoutEncounterState({
      zone: {
        layoutStrategy: 'SEQUENTIAL',
        layoutOrientation: 'TOP_BOTTOM'
      },
      actors: [enemyActor, heroActor, objectiveActor]
    });

    expect(calculateZoneLayout(state, 'zone-battlefield').descriptor).toEqual({
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
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-objective', layoutGroup: 'neutral' },
            { id: 'engagement-melee', layoutGroup: 'neutral' }
          ]
        }
      ]
    });
  });
});
