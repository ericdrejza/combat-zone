import { expect } from 'vitest';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  type EngagementConnector
} from '@ui/canvas/engagements/engagementGeometry';

export function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

export function actor(id: string, zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id,
    layoutGroup: 'hero',
    metadata: {},
    name: id,
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}

export function zone(id: string, x: number): Zone {
  return {
    colorBorder: '#9b876b',
    colorFill: '#ffffff',
    id,
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: id,
    namePosition: 'top-left',
    opacity: 0.7,
    polygon: [
      { x, y: 100 },
      { x: x + 300, y: 100 },
      { x: x + 300, y: 400 },
      { x, y: 400 }
    ],
    shape: 'rectangle',
    showBorder: true,
    showName: false,
    tags: []
  };
}

export function expectVisibleActorBranches(
  participants: Array<{ actorId: string; point: { x: number; y: number }; radius: number }>,
  connectors: EngagementConnector[]
): void {
  connectors
    .filter(
      (connector): connector is EngagementConnector & { viaActorId: string } =>
        Boolean(connector.viaActorId)
    )
    .forEach((connector) => {
      const participant = participants.find(
        ({ actorId }) => actorId === connector.actorId
      )!;
      const anchor = participants.find(
        ({ actorId }) => actorId === connector.viaActorId
      )!;
      const visibleSpan =
        Math.hypot(
          participant.point.x - anchor.point.x,
          participant.point.y - anchor.point.y
        ) -
        participant.radius -
        anchor.radius;

      expect(visibleSpan).toBeGreaterThanOrEqual(
        ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE
      );
    });
}
