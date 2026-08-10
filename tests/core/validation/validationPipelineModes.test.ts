import { describe, expect, it } from 'vitest';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import type { EncounterState } from '@core/encounter/types';
import { runValidationPipelineSync } from '@core/validation/pipeline';
import {
  createValidEncounterState
} from './validationPipelineTestSupport';

describe('validation pipeline', () => {
  it('skips validators when validation mode is OFF', () => {
    const state: EncounterState = {
      ...createValidEncounterState(),
      validationState: {
        mode: 'OFF' as const,
        messages: []
      }
    };
    const result = runValidationPipelineSync({
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
      const result = runValidationPipelineSync({
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
        mode: 'STRICT' as const,
        messages: []
      }
    };
    const result = runValidationPipelineSync({
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

  it('accepts runtime actorIds payloads for single and multi-actor movement', () => {
    const state: EncounterState = {
      ...createValidEncounterState(),
      validationState: {
        mode: 'STRICT' as const,
        messages: []
      }
    };

    for (const actionType of ['actor.move', 'actor.moveMany']) {
      const valid = runValidationPipelineSync({
        state,
        action: {
          type: actionType,
          payload: {
            actorIds: ['actor-hero', 'actor-enemy'],
            destinationZoneId: 'zone-tower'
          }
        }
      });
      expect(valid.messages).not.toContainEqual(
        expect.objectContaining({ code: 'movement.actorMissing' })
      );

      const invalid = runValidationPipelineSync({
        state,
        action: {
          type: actionType,
          payload: {
            actorIds: ['actor-hero', 'actor-missing'],
            destinationZoneId: 'zone-tower'
          }
        }
      });
      expect(invalid.messages).toContainEqual(
        expect.objectContaining({ code: 'movement.actorMissing' })
      );
    }
  });

  it('accepts valid actor movement, including movement to the zoneless area', () => {
    const state = createValidEncounterState();

    expect(
      runValidationPipelineSync({
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
      runValidationPipelineSync({
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
});
