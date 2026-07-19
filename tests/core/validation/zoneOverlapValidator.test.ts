import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import { runValidationPipeline } from '@core/validation/pipeline';
import { ZoneOverlapValidator } from '@core/validation/zoneOverlapValidator';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Zone } from '@entities/zone/types';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

const firstZone: Zone = {
  colorBorder: '#000000',
  colorFill: '#ffffff',
  id: 'first-zone',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'First Zone',
  namePosition: 'top-left',
  opacity: 1,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  shape: 'rectangle',
  showBorder: true,
  showName: false,
  tags: []
};

const secondZone: Zone = {
  ...firstZone,
  id: 'second-zone',
  name: 'Second Zone',
  polygon: [
    { x: 150, y: 0 },
    { x: 250, y: 0 },
    { x: 250, y: 100 },
    { x: 150, y: 100 }
  ]
};

function stateWithZones(zones: Zone[]): EncounterState {
  return {
    ...createEncounterState({ id: 'overlap-test', name: 'Overlap' }),
    zones: collection(zones)
  };
}

describe('ZoneOverlapValidator', () => {
  it('blocks an automatically resized zone that overlaps a neighboring zone', () => {
    const state = stateWithZones([firstZone, secondZone]);
    const nextState = {
      ...state,
      zones: collection([
        {
          ...firstZone,
          polygon: [
            { x: 0, y: 0 },
            { x: 180, y: 0 },
            { x: 180, y: 100 },
            { x: 0, y: 100 }
          ]
        },
        secondZone
      ])
    };
    const result = runValidationPipeline({
      action: {
        type: 'actor.create',
        payload: {
          actorId: 'new-actor',
          destinationZoneId: firstZone.id
        }
      },
      nextState,
      state,
      validators: [ZoneOverlapValidator]
    });

    expect(result.blocked).toBe(true);
    expect(result.messages).toEqual([
      expect.objectContaining({
        code: 'zone.overlap',
        severity: 'error'
      })
    ]);
  });
});
