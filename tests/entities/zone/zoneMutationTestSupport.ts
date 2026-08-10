import type { Actor } from '@entities/actor/types';
import type { Edge } from '@entities/edge/types';
import type { Engagement } from '@entities/engagement/types';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import reducer, { commitEncounterChange } from '@store/encounterSlice';
import type { Zone } from '@entities/zone/types';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

export const zone: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-room',
  name: 'Room',
  namePosition: 'top-left',
  opacity: 0.7,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  showBorder: true,
  showName: false,
  shape: 'rectangle',
  layoutStrategy: 'FLEX',
  layoutOrientation: 'LEFT_RIGHT',
  tags: []
};

export const actorInZone: Actor = {
  id: 'actor-hero',
  name: 'Hero',
  actorType: 'creature',
  layoutGroup: 'hero',
  size: 'medium',
  shape: 'circle',
  currentZoneId: zone.id,
  statusEffects: [],
  metadata: {}
};

export const actorOutsideZone: Actor = {
  id: 'actor-enemy',
  name: 'Enemy',
  actorType: 'creature',
  layoutGroup: 'enemy',
  size: 'medium',
  shape: 'circle',
  currentZoneId: ZONELESS_ACTOR_ZONE_ID,
  statusEffects: [],
  metadata: {}
};

export const connectedEdge: Edge = {
  id: 'edge-room-hall',
  fromZoneId: zone.id,
  toZoneId: 'zone-hall',
  directionality: 'bilateral',
  movementRules: [],
  visibilityRule: 'visible',
  shape: 'straight',
  interactionTags: []
};

export const unrelatedEdge: Edge = {
  ...connectedEdge,
  id: 'edge-other',
  fromZoneId: 'zone-hall',
  toZoneId: 'zone-yard'
};

export const engagementInZone: Engagement = {
  id: 'engagement-room',
  participantIds: ['actor-hero', 'actor-enemy'],
  parentZoneId: zone.id,
  layoutStrategy: 'SEQUENTIAL',
  layoutOrientation: 'LEFT_RIGHT'
};

export function createZoneEncounterState() {
  return {
    ...createEncounterState({
      id: 'encounter-zones',
      name: 'Zone Encounter'
    }),
    zones: collection([zone]),
    actors: collection([actorInZone, actorOutsideZone]),
    edges: collection([connectedEdge, unrelatedEdge]),
    engagements: collection([engagementInZone])
  };
}

export function commitState(
  state: ReturnType<typeof reducer>,
  type: string,
  nextEncounter: ReturnType<typeof createZoneEncounterState>
) {
  return reducer(
    state,
    commitEncounterChange({
      action: createEncounterActionRecord(type),
      nextEncounter
    })
  );
}
