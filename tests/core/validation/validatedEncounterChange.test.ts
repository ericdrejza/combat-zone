import { describe, expect, it } from 'vitest';

import type { EncounterState } from '@core/encounter/types';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createValidEncounterState } from './validationPipelineTestSupport';

describe('validation pipeline', () => {
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
