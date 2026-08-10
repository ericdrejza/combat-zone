import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import { buildActor } from '@entities/actor/actorMutations';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export const zone: Zone = {
  colorBorder: '#000000',
  colorFill: '#ffffff',
  id: 'tight-zone',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'Tight Zone',
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

export const existingActor: Actor = buildActor({
  currentZoneId: zone.id,
  id: 'existing-actor'
});

export function createState(
  mode: EncounterState['validationState']['mode'],
  layoutStrategy: Zone['layoutStrategy'] = 'FLEX'
) {
  return {
    ...createEncounterState({ id: 'layout-validation', name: 'Layout' }),
    actors: collection([existingActor]),
    validationState: { mode, messages: [] },
    zones: collection([{ ...zone, layoutStrategy }])
  };
}
