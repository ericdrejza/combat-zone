import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Engagement } from '@entities/engagement/types';
import type { Zone } from '@entities/zone/types';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

export const battlefieldZone: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-battlefield',
  name: 'Battlefield',
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
  layoutStrategy: 'SPLIT_SEQUENTIAL',
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
  currentZoneId: 'zone-battlefield',
  statusEffects: [],
  metadata: {}
};

export const secondHeroActor: Actor = {
  id: 'actor-second-hero',
  name: 'Second Hero',
  actorType: 'creature',
  layoutGroup: 'hero',
  size: 'medium',
  shape: 'circle',
  currentZoneId: 'zone-battlefield',
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
  currentZoneId: 'zone-battlefield',
  statusEffects: [],
  metadata: {}
};

export const objectiveActor: Actor = {
  id: 'actor-objective',
  name: 'Objective',
  actorType: 'objective',
  layoutGroup: 'neutral',
  size: 'medium',
  shape: 'circle',
  currentZoneId: 'zone-battlefield',
  statusEffects: [],
  metadata: {}
};

export const engagement: Engagement = {
  id: 'engagement-melee',
  participantIds: ['actor-hero', 'actor-enemy'],
  parentZoneId: 'zone-battlefield',
  layoutStrategy: 'SEQUENTIAL',
  layoutOrientation: 'TOP_BOTTOM'
};

export function createLayoutEncounterState(overrides?: {
  zone?: Partial<Zone>;
  actors?: Actor[];
  engagement?: Partial<Engagement>;
}): EncounterState {
  const zone = {
    ...battlefieldZone,
    ...overrides?.zone
  };
  const actors = overrides?.actors ?? [
    heroActor,
    secondHeroActor,
    enemyActor,
    objectiveActor
  ];

  return {
    ...createEncounterState({
      id: 'encounter-layout',
      name: 'Layout Encounter'
    }),
    zones: collection([zone]),
    actors: collection(actors),
    engagements: collection([
      {
        ...engagement,
        ...overrides?.engagement
      }
    ])
  };
}
