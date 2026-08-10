import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createActor, moveActor } from '@entities/actor/actorMutations';
import { createEngagement, joinEngagement } from '@entities/engagement/engagementMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon engagement capacity validation', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'rearranges two large engagements into chains when growing one in %s mode',
    (mode) => {
      const chainZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
          { x: 500, y: 360 },
          { x: 0, y: 360 }
        ]
      };
      const actors = Array.from({ length: 20 }, (_, index) => ({
        ...existingActor,
        id: `chain-growth-${index}`
      }));
      const baseEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([chainZone])
      };
      const withLarge = createEngagement(baseEncounter, {
        id: 'nine',
        parentZoneId: chainZone.id,
        participantIds: actors.slice(0, 9).map(({ id }) => id)
      });
      const currentEncounter = createEngagement(withLarge, {
        id: 'eight',
        parentZoneId: chainZone.id,
        participantIds: actors.slice(9, 17).map(({ id }) => id)
      });
      const joiningIds = actors.slice(17).map(({ id }) => id);
      const nextEncounter = joinEngagement(
        currentEncounter,
        'eight',
        joiningIds
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.join', {
          actorIds: joiningIds,
          engagementId: 'eight'
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.validationResult.messages).toEqual([]);
      expect(prepared.blocked).toBe(false);
      expect(
        prepared.nextEncounter.engagements.byId.eight?.participantIds
      ).toHaveLength(11);
    }
  );

  it.each(['ADVISORY', 'STRICT'] as const)(
    'repacks a multi-actor zone move around an existing engagement in %s mode',
    (mode) => {
      const destination = {
        ...zone,
        id: 'destination',
        polygon: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 450 },
          { x: 0, y: 450 }
        ]
      };
      const source = {
        ...zone,
        id: 'source',
        polygon: [
          { x: 700, y: 0 },
          { x: 1300, y: 0 },
          { x: 1300, y: 450 },
          { x: 700, y: 450 }
        ]
      };
      const destinationActors = Array.from({ length: 6 }, (_, index) => ({
        ...existingActor,
        currentZoneId: destination.id,
        id: `destination-${index}`,
        shape: index % 2 === 0 ? 'rectangle' as const : 'circle' as const
      }));
      const movingActors = Array.from({ length: 5 }, (_, index) => ({
        ...existingActor,
        currentZoneId: source.id,
        id: `moving-${index}`,
        shape: index % 2 === 0 ? 'rectangle' as const : 'circle' as const
      }));
      const baseEncounter = {
        ...createEncounterState({ id: 'move-many-overlap', name: 'Move many' }),
        actors: collection([...destinationActors, ...movingActors]),
        validationState: { mode, messages: [] },
        zones: collection([destination, source])
      };
      const currentEncounter = createEngagement(baseEncounter, {
        id: 'existing-melee',
        parentZoneId: destination.id,
        participantIds: destinationActors.map(({ id }) => id)
      });
      const movingIds = movingActors.map(({ id }) => id);
      const nextEncounter = movingIds.reduce(
        (encounter, actorId) =>
          moveActor(encounter, actorId, destination.id),
        currentEncounter
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.moveMany', {
          actorIds: movingIds,
          destinationZoneId: destination.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.validationResult.messages).not.toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/Overlap|NoSpace/)
        })
      );
    }
  );

  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'allows an engagement in a populated zone when its complete geometry fits in %s mode',
    (mode) => {
      const populatedZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 }
        ]
      };
      const actors = Array.from({ length: 10 }, (_, index) => ({
        ...existingActor,
        id: `populated-${index}`
      }));
      const currentEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([populatedZone])
      };
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'populated-melee',
        parentZoneId: populatedZone.id,
        participantIds: ['populated-0', 'populated-1']
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: populatedZone.id,
          participantIds: ['populated-0', 'populated-1']
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.validationResult.messages).not.toContainEqual(
        expect.objectContaining({ code: 'layout.engagementNoSpace' })
      );
    }
  );

  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'allows another actor after an engagement when the remaining zone space fits in %s mode',
    (mode) => {
      const populatedZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 }
        ]
      };
      const actors = Array.from({ length: 9 }, (_, index) => ({
        ...existingActor,
        id: `existing-${index}`
      }));
      const baseEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([populatedZone])
      };
      const currentEncounter = createEngagement(baseEncounter, {
        id: 'existing-melee',
        parentZoneId: populatedZone.id,
        participantIds: ['existing-0', 'existing-1']
      });
      const nextEncounter = createActor(currentEncounter, {
        currentZoneId: populatedZone.id,
        id: 'new-single'
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.create', {
          actorId: 'new-single',
          destinationZoneId: populatedZone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.nextEncounter.actors.byId['new-single']).toBeDefined();
    }
  );

});
