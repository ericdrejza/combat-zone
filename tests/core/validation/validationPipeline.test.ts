import { describe, expect, it } from 'vitest';

import type { Actor } from '@entities/actor/types';
import type { Edge } from '@entities/edge/types';
import type { Engagement } from '@entities/engagement/types';
import type { Zone } from '@entities/zone/types';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EncounterState } from '@core/encounter/types';
import type { EntityCollection } from '@core/state/entityCollection';
import { runValidationPipeline } from '@core/validation/pipeline';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

const courtyardZone: Zone = {
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

const towerZone: Zone = {
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

const heroActor: Actor = {
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

const enemyActor: Actor = {
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

function createValidEncounterState(): EncounterState {
  return {
    ...createEncounterState({
      id: 'encounter-validation',
      name: 'Validation Encounter'
    }),
    zones: collection([courtyardZone, towerZone]),
    actors: collection([heroActor, enemyActor])
  };
}

describe('validation pipeline', () => {
  it('skips validators when validation mode is OFF', () => {
    const state: EncounterState = {
      ...createValidEncounterState(),
      validationState: {
        mode: 'OFF',
        messages: []
      }
    };
    const result = runValidationPipeline({
      state,
      action: {
        type: 'actor.move',
        payload: {
          actorId: 'actor-missing',
          destinationZoneId: 'zone-missing'
        }
      }
    });

    expect(result).toEqual({
      mode: 'OFF',
      valid: true,
      blocked: false,
      messages: []
    });
  });

  it('preserves GM authority outside STRICT mode', () => {
    for (const mode of ['ADVISORY', 'ASSISTED'] as const) {
      const state: EncounterState = {
        ...createValidEncounterState(),
        validationState: {
          mode,
          messages: []
        }
      };
      const result = runValidationPipeline({
        state,
        action: {
          type: 'actor.move',
          payload: {
            actorId: 'actor-missing',
            destinationZoneId: 'zone-missing'
          }
        }
      });

      expect(result.mode).toBe(mode);
      expect(result.valid).toBe(false);
      expect(result.blocked).toBe(false);
      expect(result.messages.map((message) => message.code)).toEqual([
        'movement.actorMissing',
        'movement.destinationZoneMissing'
      ]);
    }
  });

  it('blocks invalid actions only in STRICT mode', () => {
    const state: EncounterState = {
      ...createValidEncounterState(),
      validationState: {
        mode: 'STRICT',
        messages: []
      }
    };
    const result = runValidationPipeline({
      state,
      action: {
        type: 'actor.move',
        payload: {
          actorId: 'actor-missing',
          destinationZoneId: 'zone-missing'
        }
      }
    });

    expect(result.valid).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('accepts valid actor movement, including movement to the zoneless area', () => {
    const state = createValidEncounterState();

    expect(
      runValidationPipeline({
        state,
        action: {
          type: 'actor.move',
          payload: {
            actorId: 'actor-hero',
            destinationZoneId: 'zone-tower'
          }
        }
      })
    ).toMatchObject({
      valid: true,
      blocked: false,
      messages: []
    });

    expect(
      runValidationPipeline({
        state,
        action: {
          type: 'actor.move',
          payload: {
            actorId: 'actor-hero',
            destinationZoneId: ZONELESS_ACTOR_ZONE_ID
          }
        }
      })
    ).toMatchObject({
      valid: true,
      blocked: false,
      messages: []
    });
  });

  it('validates edge creation and updates against zone graph integrity', () => {
    const state = createValidEncounterState();

    expect(
      runValidationPipeline({
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
      runValidationPipeline({
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
    const result = runValidationPipeline({
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
      directionality: 'two-way',
      movementRule: 'free',
      visibilityRule: 'clear',
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
    const result = runValidationPipeline({
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
      'zoneIntegrity.engagementParticipantMissing'
    ]);
  });

  it('prepares validated changes with action metadata and panel-ready messages', () => {
    const currentEncounter = createValidEncounterState();
    const nextEncounter: EncounterState = {
      ...currentEncounter,
      name: 'Renamed Encounter'
    };
    const prepared = prepareValidatedEncounterChange({
      currentEncounter,
      nextEncounter,
      action: {
        id: 'action-rename',
        type: 'actor.move',
        timestamp: 1,
        payload: {
          actorId: 'actor-missing',
          destinationZoneId: 'zone-missing'
        }
      }
    });

    expect(prepared.blocked).toBe(false);
    expect(prepared.action.validationResult?.valid).toBe(false);
    expect(prepared.nextEncounter.validationState).toEqual({
      mode: 'ADVISORY',
      messages: prepared.validationResult.messages
    });
  });
});
