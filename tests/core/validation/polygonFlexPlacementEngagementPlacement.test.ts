import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, createActor, moveActor } from '@entities/actor/actorMutations';
import { createEngagement, joinEngagement } from '@entities/engagement/engagementMutations';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon engagement placement validation', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'allows a large engagement whenever all participants and its token fit in %s mode',
    (mode) => {
      const spaciousZone = {
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
        id: `large-engagement-${index}`
      }));
      const currentEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([spaciousZone])
      };
      const participantIds = actors.map(({ id }) => id);
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'large-melee',
        parentZoneId: spaciousZone.id,
        participantIds
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: spaciousZone.id,
          participantIds
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.validationResult.messages).toEqual([]);
      expect(prepared.blocked).toBe(false);
      expect(prepared.validationResult.messages).not.toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/^layout\.engagement/)
        })
      );
    }
  );

  it.each(['ADVISORY', 'STRICT'] as const)(
    'blocks a second engagement that could fit only by nesting inside the first in %s mode',
    (mode) => {
      const nestingZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 260, y: 0 },
          { x: 260, y: 260 },
          { x: 0, y: 260 }
        ]
      };
      const actors = Array.from({ length: 10 }, (_, index) => ({
        ...existingActor,
        id: `nested-${index}`
      }));
      const baseEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([nestingZone])
      };
      const currentEncounter = createEngagement(baseEncounter, {
        id: 'large',
        parentZoneId: nestingZone.id,
        participantIds: actors.slice(0, 8).map(({ id }) => id)
      });
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'small',
        parentZoneId: nestingZone.id,
        participantIds: actors.slice(8).map(({ id }) => id)
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: nestingZone.id,
          participantIds: actors.slice(8).map(({ id }) => id)
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toContainEqual(
        expect.objectContaining({
          code: 'layout.engagementNoSpace',
          severity: 'error'
        })
      );
    }
  );

  it.each(['ADVISORY', 'STRICT'] as const)(
    'allows actors to join the smaller of two separated engagements in %s mode',
    (mode) => {
      const spaciousZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 900, y: 0 },
          { x: 900, y: 500 },
          { x: 0, y: 500 }
        ]
      };
      const actors = Array.from({ length: 12 }, (_, index) => ({
        ...existingActor,
        id: `growing-${index}`
      }));
      const baseEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([spaciousZone])
      };
      const withLarge = createEngagement(baseEncounter, {
        id: 'large',
        parentZoneId: spaciousZone.id,
        participantIds: actors.slice(0, 8).map(({ id }) => id)
      });
      const currentEncounter = createEngagement(withLarge, {
        id: 'small',
        parentZoneId: spaciousZone.id,
        participantIds: actors.slice(8, 10).map(({ id }) => id)
      });
      const joiningIds = actors.slice(10).map(({ id }) => id);
      const nextEncounter = joinEngagement(
        currentEncounter,
        'small',
        joiningIds
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.join', {
          actorIds: joiningIds,
          engagementId: 'small'
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(
        prepared.nextEncounter.engagements.byId.small?.participantIds
      ).toHaveLength(4);
    }
  );

  it.each(['ADVISORY', 'STRICT'] as const)(
    'rotates a mixed-size engagement into zone corners when an actor joins in %s mode',
    (mode) => {
      const cornerZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 276, y: 0 },
          { x: 276, y: 246 },
          { x: 0, y: 246 }
        ]
      };
      const largeActor = buildActor({
        currentZoneId: cornerZone.id,
        id: 'large-participant',
        size: 'large'
      });
      const mediumActors = Array.from({ length: 3 }, (_, index) =>
        buildActor({
          currentZoneId: cornerZone.id,
          id: `medium-participant-${index}`
        })
      );
      const currentEncounter = createEngagement(
        {
          ...createState(mode),
          actors: collection([largeActor, ...mediumActors]),
          zones: collection([cornerZone])
        },
        {
          id: 'corner-melee',
          parentZoneId: cornerZone.id,
          participantIds: [
            largeActor.id,
            ...mediumActors.slice(0, 2).map(({ id }) => id)
          ]
        }
      );
      const nextEncounter = joinEngagement(
        currentEncounter,
        'corner-melee',
        [mediumActors[2].id]
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.join', {
          actorIds: [mediumActors[2].id],
          targetEngagementId: 'corner-melee'
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.nextEncounter.zones.byId[cornerZone.id]?.polygon)
        .toEqual(cornerZone.polygon);
      expect(prepared.validationResult.messages).not.toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/^layout\.engagement/)
        })
      );
    }
  );
});
