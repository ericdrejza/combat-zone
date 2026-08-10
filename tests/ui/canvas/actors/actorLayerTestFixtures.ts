import type { EntityCollection } from '@core/state/entityCollection';
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

export function createZone(): Zone {
  return {
    colorBorder: '#166534',
    colorFill: '#000000',
    id: 'zone-round',
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: 'Round Zone',
    namePosition: 'top-left',
    opacity: 1,
    polygon: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 }
    ],
    shape: 'circle',
    showBorder: true,
    showName: true,
    tags: []
  };
}

export function createActor(zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id: 'actor-1',
    image: 'data:image/png;base64,actor',
    layoutGroup: 'hero',
    metadata: {},
    name: 'Aegis',
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}
