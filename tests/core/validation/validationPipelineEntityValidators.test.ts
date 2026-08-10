import { describe, expect, it } from 'vitest';

import type { Actor } from '@entities/actor/types';
import type { Edge } from '@entities/edge/types';
import type { Engagement } from '@entities/engagement/types';
import type { EncounterState } from '@core/encounter/types';
import { runValidationPipelineSync } from '@core/validation/pipeline';
import {
  collection,
  createValidEncounterState,
  heroActor
} from './validationPipelineTestSupport';

describe('validation pipeline', () => {
  it('validates edge creation and updates against zone graph integrity', () => {
    const state = createValidEncounterState();

    expect(
      runValidationPipelineSync({
        state,
        action: {
          type: 'edge.create',
          payload: {
            fromZoneId: 'zone-courtyard',
            toZoneId: 'zone-courtyard'
          }
        }
      }).messages.map((message) => message.code)
    ).toEqual(['edge.selfReference']);

    expect(
      runValidationPipelineSync({
        state,
        action: {
          type: 'edge.update',
          payload: {
            fromZoneId: 'zone-missing',
            toZoneId: 'zone-courtyard'
          }
        }
      }).messages.map((message) => message.code)
    ).toEqual(['edge.fromZoneMissing']);
  });

  it('validates engagement membership and parent zone references', () => {
    const state = createValidEncounterState();
    const result = runValidationPipelineSync({
      state,
      action: {
        type: 'engagement.create',
        payload: {
          parentZoneId: 'zone-missing',
          participantIds: ['actor-hero', 'actor-missing']
        }
      }
    });

    expect(result.messages.map((message) => message.code)).toEqual([
      'engagement.parentZoneMissing',
      'engagement.participantMissing'
    ]);
  });

  it('reports existing encounter integrity issues regardless of action type', () => {
    const brokenActor: Actor = {
      ...heroActor,
      id: 'actor-broken-zone',
      currentZoneId: 'zone-missing'
    };
    const brokenEdge: Edge = {
      id: 'edge-broken',
      fromZoneId: 'zone-courtyard',
      toZoneId: 'zone-missing',
      directionality: 'bilateral',
      movementRules: [],
      visibilityRule: 'visible',
      shape: 'straight',
      interactionTags: []
    };
    const brokenEngagement: Engagement = {
      id: 'engagement-broken',
      participantIds: ['actor-hero', 'actor-missing'],
      parentZoneId: 'zone-missing',
      layoutStrategy: 'FLEX',
      layoutOrientation: 'LEFT_RIGHT'
    };
    const state: EncounterState = {
      ...createValidEncounterState(),
      actors: collection([heroActor, brokenActor]),
      edges: collection([brokenEdge]),
      engagements: collection([brokenEngagement])
    };
    const result = runValidationPipelineSync({
      state,
      action: {
        type: 'encounter.rename',
        payload: {
          name: 'Renamed Encounter'
        }
      }
    });

    expect(result.messages.map((message) => message.code)).toEqual([
      'zoneIntegrity.actorZoneMissing',
      'zoneIntegrity.edgeToZoneMissing',
      'zoneIntegrity.engagementParentZoneMissing',
      'zoneIntegrity.engagementParticipantOutsideParentZone',
      'zoneIntegrity.engagementParticipantMissing'
    ]);
  });
});
