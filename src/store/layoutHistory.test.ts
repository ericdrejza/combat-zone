import { describe, expect, it } from 'vitest';

import type { Zone } from '../entities/zone/types';
import type { EntityCollection } from '../core/state/entityCollection';
import { calculateZoneLayout } from '../core/layout/encounterLayout';
import reducer, {
  commitEncounterChange,
  undoEncounterChange
} from './encounterSlice';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

describe('layout strategy changes through Redux history', () => {
  it('immediately reflows derived layout after a history-tracked strategy change and undoes exactly', () => {
    const initialHistory = reducer(undefined, { type: 'test/init' });
    const zone: Zone = {
      colorBorder: '#9b876b',
      colorFill: '#ffffff',
      id: 'zone-layout',
      name: 'Layout Zone',
      namePosition: 'top-left',
      opacity: 0.7,
      polygon: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 120 },
        { x: 0, y: 120 }
      ],
      showBorder: true,
      showName: false,
      shape: 'rectangle',
      layoutStrategy: 'FLEX',
      layoutOrientation: 'LEFT_RIGHT',
      tags: []
    };
    const present = {
      ...initialHistory.present,
      zones: collection([zone]),
      actors: collection([
        {
          id: 'actor-hero',
          name: 'Hero',
          actorType: 'creature' as const,
          layoutGroup: 'hero' as const,
          size: 'medium' as const,
          shape: 'circle' as const,
          currentZoneId: 'zone-layout',
          statusEffects: [],
          metadata: {}
        },
        {
          id: 'actor-enemy',
          name: 'Enemy',
          actorType: 'creature' as const,
          layoutGroup: 'enemy' as const,
          size: 'medium' as const,
          shape: 'circle' as const,
          currentZoneId: 'zone-layout',
          statusEffects: [],
          metadata: {}
        }
      ])
    };
    const historyWithZone = {
      ...initialHistory,
      present
    };
    const nextEncounter = {
      ...present,
      zones: {
        ...present.zones,
        byId: {
          ...present.zones.byId,
          'zone-layout': {
            ...zone,
            layoutStrategy: 'SEQUENTIAL' as const,
            layoutOrientation: 'TOP_BOTTOM' as const
          }
        }
      }
    };

    const committedHistory = reducer(
      historyWithZone,
      commitEncounterChange({
        action: {
          id: 'layout-change-1',
          type: 'zone.changeLayoutStrategy',
          timestamp: 1,
          payload: {
            zoneId: 'zone-layout',
            layoutStrategy: 'SEQUENTIAL',
            layoutOrientation: 'TOP_BOTTOM'
          }
        },
        nextEncounter
      })
    );

    expect(
      calculateZoneLayout(historyWithZone.present, 'zone-layout').descriptor
    ).toEqual({
      strategy: 'FLEX',
      orientation: 'LEFT_RIGHT',
      className: 'cz-layout cz-layout-flex cz-layout-orientation-left-right',
      sections: [
        {
          id: 'all',
          className: 'cz-layout-section-all',
          items: [
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' }
          ]
        }
      ]
    });
    expect(
      calculateZoneLayout(committedHistory.present, 'zone-layout').descriptor
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
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' }
          ]
        }
      ]
    });

    const undoneHistory = reducer(committedHistory, undoEncounterChange());

    expect(undoneHistory.present).toEqual(historyWithZone.present);
    expect(
      calculateZoneLayout(undoneHistory.present, 'zone-layout').descriptor
    ).toEqual({
      strategy: 'FLEX',
      orientation: 'LEFT_RIGHT',
      className: 'cz-layout cz-layout-flex cz-layout-orientation-left-right',
      sections: [
        {
          id: 'all',
          className: 'cz-layout-section-all',
          items: [
            { id: 'actor-hero', layoutGroup: 'hero' },
            { id: 'actor-enemy', layoutGroup: 'enemy' }
          ]
        }
      ]
    });
  });
});
