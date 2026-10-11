import { describe, expect, it } from 'vitest';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, createActor, moveActor } from '@entities/actor/actorMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { collection, createState, zone } from './polygonFlexPlacementTestSupport';

const polygon = [{ x: 0, y: 0 }, { x: 260, y: 0 }, { x: 260, y: 320 }, { x: 0, y: 320 }];

describe('Flex actor entry with rendered circle clearance', () => {
  for (const layoutStrategy of ['FLEX', 'SPLIT_FLEX'] as const) {
    for (const mode of ['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const) {
      it.each(['move', 'create'] as const)(`${layoutStrategy} allows a fitting xLarge actor %s in ${mode} with exact history`, (operation) => {
        const incoming = buildActor({ id: 'incoming', size: 'xLarge', layoutGroup: 'enemy', currentZoneId: 'zoneless' });
        const residents = Array.from({ length: 7 }, (_, index) => buildActor({
          id: String(index), currentZoneId: zone.id, layoutGroup: 'enemy'
        }));
        const currentEncounter = {
          ...createState(mode, layoutStrategy),
          zones: collection([{ ...zone, polygon, layoutStrategy, autoResize: false }]),
          actors: collection(operation === 'move' ? [...residents, incoming] : residents)
        };
        const nextEncounter = operation === 'move'
          ? moveActor(currentEncounter, incoming.id, zone.id)
          : createActor(currentEncounter, {
              id: incoming.id, size: incoming.size,
              layoutGroup: incoming.layoutGroup, currentZoneId: zone.id
            });
        const prepared = prepareValidatedEncounterChange({
          action: createEncounterActionRecord(`actor.${operation}`, {
            actorId: incoming.id, destinationZoneId: zone.id
          }),
          currentEncounter,
          nextEncounter
        });

        expect(prepared.blocked).toBe(false);
        expect(prepared.validationResult.valid).toBe(true);
        expect(prepared.nextEncounter.zones.byId[zone.id].polygon).toEqual(polygon);
        expect(prepared.nextEncounter.actors.byId[incoming.id].currentZoneId).toBe(zone.id);

        let history = reducer(undefined, { type: 'test/init' });
        history = reducer(history, commitEncounterChange({
          action: createEncounterActionRecord('seed'), nextEncounter: currentEncounter
        }));
        history = reducer(history, commitEncounterChange({
          action: prepared.action, nextEncounter: prepared.nextEncounter
        }));
        const undone = reducer(history, undoEncounterChange());
        expect(undone.present).toEqual(currentEncounter);
        expect(reducer(undone, redoEncounterChange()).present).toEqual(prepared.nextEncounter);
      });
    }
  }
});
