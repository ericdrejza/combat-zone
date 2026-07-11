import type { Actor } from '../../entities/actor/types';
import type { Engagement } from '../../entities/engagement/types';
import type { EncounterState } from '../encounter/types';
import { getEntities } from '../state/entityCollection';
import { getLayoutStrategy } from './strategies';
import type { LayoutDescriptor, LayoutEntity } from './types';

export type ZoneLayoutResult = {
  descriptor: LayoutDescriptor;
};

export type EngagementLayoutResult = {
  descriptor: LayoutDescriptor;
};

function getActorsInCollectionOrder(
  state: EncounterState,
  predicate: (actor: Actor) => boolean
): Actor[] {
  return getEntities(state.actors).filter(predicate);
}

function getEngagementsInCollectionOrder(
  state: EncounterState,
  predicate: (engagement: Engagement) => boolean
): Engagement[] {
  return getEntities(state.engagements).filter(predicate);
}

export function calculateZoneLayout(
  state: EncounterState,
  zoneId: string
): ZoneLayoutResult {
  const zone = state.zones.byId[zoneId];

  if (!zone) {
    return {
      descriptor: getLayoutStrategy('FLEX').describe({
        entities: [],
        orientation: 'LEFT_RIGHT'
      })
    };
  }

  const actors = getActorsInCollectionOrder(
    state,
    (actor) => actor.currentZoneId === zoneId
  );
  const engagements = getEngagementsInCollectionOrder(
    state,
    (engagement) => engagement.parentZoneId === zoneId
  );
  const renderables: LayoutEntity[] = [
    ...actors.map((actor) => ({
      id: actor.id,
      layoutGroup: actor.layoutGroup
    })),
    ...engagements.map((engagement) => ({
      id: engagement.id,
      layoutGroup: 'neutral' as const
    }))
  ];

  return {
    descriptor: getLayoutStrategy(zone.layoutStrategy).describe({
      entities: renderables,
      orientation: zone.layoutOrientation
    })
  };
}

export function calculateEngagementLayout(
  state: EncounterState,
  engagementId: string
): EngagementLayoutResult {
  const engagement = state.engagements.byId[engagementId];
  const zone = engagement
    ? state.zones.byId[engagement.parentZoneId]
    : undefined;

  if (!engagement || !zone) {
    return {
      descriptor: getLayoutStrategy('FLEX').describe({
        entities: [],
        orientation: 'LEFT_RIGHT'
      })
    };
  }

  const participantIds = new Set(engagement.participantIds);
  const participants = getActorsInCollectionOrder(state, (actor) =>
    participantIds.has(actor.id)
  );

  return {
    descriptor: getLayoutStrategy(engagement.layoutStrategy).describe({
      entities: participants.map((actor) => ({
        id: actor.id,
        layoutGroup: actor.layoutGroup
      })),
      orientation: engagement.layoutOrientation
    })
  };
}
