import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import reducer, { commitEncounterChange } from '@store/encounterSlice';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

export const zoneA: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-a',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'Zone A',
  namePosition: 'top-left',
  opacity: 0.7,
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

export const zoneB: Zone = {
  ...zoneA,
  id: 'zone-b',
  name: 'Zone B'
};

export const actor: Actor = {
  actorType: 'creature',
  currentZoneId: zoneA.id,
  id: 'actor-hero',
  layoutGroup: 'hero',
  metadata: {},
  name: 'Hero',
  shape: 'circle',
  size: 'medium',
  statusEffects: []
};

export function createActorEncounterState() {
  return {
    ...createEncounterState({
      id: 'encounter-actors',
      name: 'Actor Encounter'
    }),
    zones: collection([zoneA, zoneB]),
    actors: collection([actor])
  };
}

export function commitState(
  state: ReturnType<typeof reducer>,
  type: string,
  nextEncounter: ReturnType<typeof createActorEncounterState>
) {
  return reducer(
    state,
    commitEncounterChange({
      action: createEncounterActionRecord(type),
      nextEncounter
    })
  );
}
