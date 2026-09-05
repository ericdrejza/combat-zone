import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import reducer, {
  redoEncounterChange,
  undoEncounterChange
} from '@store/encounterSlice';
import {
  deleteActor,
  duplicateActor,
  moveActor,
  updateActorProperties
} from '@entities/actor/actorMutations';
import {
  actor,
  commitState,
  createActorEncounterState,
  zoneB
} from './actorMutationsTestSupport';

describe('actor mutations', () => {
  it('updates actor properties, duplicates actors, and deletes actors reversibly', () => {
    const initialHistory = reducer(undefined, { type: 'test/init' });
    let state = commitState(
      initialHistory,
      'test.seed',
      createActorEncounterState()
    );
    const updatedEncounter = updateActorProperties(state.present, actor.id, {
      actorType: 'objective',
      layoutGroup: 'ally',
      name: 'Relic',
      shape: 'rectangle',
      size: 'xLarge'
    });

    state = commitState(state, 'actor.updateProperties', updatedEncounter);
    expect(state.present.actors.byId[actor.id]).toMatchObject({
      actorType: 'objective',
      layoutGroup: 'ally',
      name: 'Relic',
      shape: 'rectangle',
      size: 'xLarge'
    });

    const duplicatedEncounter = duplicateActor(
      state.present,
      actor.id,
      'actor-copy',
      zoneB.id
    );
    state = commitState(state, 'actor.duplicate', duplicatedEncounter);
    expect(state.present.actors.byId['actor-copy']).toMatchObject({
      currentZoneId: zoneB.id,
      name: 'Relic Copy'
    });

    const deletedEncounter = deleteActor(state.present, actor.id);
    state = commitState(state, 'actor.delete', deletedEncounter);
    expect(state.present.actors.byId[actor.id]).toBeUndefined();

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId[actor.id]).toBeDefined();

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(deletedEncounter);
  });

  it('blocks invalid actor moves in STRICT mode and allows them with messages in ADVISORY mode', () => {
    const strictEncounter = {
      ...createActorEncounterState(),
      validationState: {
        messages: [],
        mode: 'STRICT' as const
      }
    };
    const invalidMove = moveActor(strictEncounter, actor.id, 'zone-missing');
    const strictResult = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.move', {
        actorId: actor.id,
        destinationZoneId: 'zone-missing'
      }),
      currentEncounter: strictEncounter,
      nextEncounter: invalidMove
    });

    expect(strictResult.blocked).toBe(true);

    const advisoryEncounter = {
      ...strictEncounter,
      validationState: {
        messages: [],
        mode: 'ADVISORY' as const
      }
    };
    const advisoryResult = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.move', {
        actorId: actor.id,
        destinationZoneId: 'zone-missing'
      }),
      currentEncounter: advisoryEncounter,
      nextEncounter: moveActor(advisoryEncounter, actor.id, 'zone-missing')
    });

    expect(advisoryResult.blocked).toBe(false);
    expect(advisoryResult.validationResult.messages).toEqual([
      expect.objectContaining({
        code: 'movement.destinationZoneMissing'
      })
    ]);
  });
});
