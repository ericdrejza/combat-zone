import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

export const courtyardZone: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-courtyard',
  name: 'Courtyard',
  namePosition: 'top-left',
  opacity: 0.7,
  polygon: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 }
  ],
  showBorder: true,
  showName: false,
  shape: 'polygon',
  layoutStrategy: 'FLEX',
  layoutOrientation: 'LEFT_RIGHT',
  tags: []
};

export const towerZone: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-tower',
  name: 'Tower',
  namePosition: 'top-left',
  opacity: 0.7,
  polygon: [
    { x: 20, y: 0 },
    { x: 30, y: 0 },
    { x: 30, y: 10 }
  ],
  showBorder: true,
  showName: false,
  shape: 'polygon',
  layoutStrategy: 'SEQUENTIAL',
  layoutOrientation: 'LEFT_RIGHT',
  tags: []
};

export const heroActor: Actor = {
  id: 'actor-hero',
  name: 'Hero',
  actorType: 'creature',
  layoutGroup: 'hero',
  size: 'medium',
  shape: 'circle',
  currentZoneId: 'zone-courtyard',
  statusEffects: [],
  metadata: {}
};

export const enemyActor: Actor = {
  id: 'actor-enemy',
  name: 'Enemy',
  actorType: 'creature',
  layoutGroup: 'enemy',
  size: 'medium',
  shape: 'circle',
  currentZoneId: 'zone-courtyard',
  statusEffects: [],
  metadata: {}
};

export function createValidEncounterState(): EncounterState {
  return {
    ...createEncounterState({
      id: 'encounter-validation',
      name: 'Validation Encounter'
    }),
    zones: collection([courtyardZone, towerZone]),
    actors: collection([heroActor, enemyActor])
  };
}
