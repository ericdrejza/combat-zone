import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEngagement } from '@entities/engagement/engagementMutations';
import { updateZoneProperties } from '@entities/zone/zoneMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon engagement geometry capacity validation', () => {
  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'blocks an engagement token that cannot fit between otherwise fitting actors in %s mode',
    (mode) => {
      const narrowZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 145, y: 0 },
          { x: 145, y: 100 },
          { x: 0, y: 100 }
        ]
      };
      const actors = [
        { ...existingActor, id: 'left' },
        { ...existingActor, id: 'right' }
      ];
      const currentEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([narrowZone])
      };
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'narrow-melee',
        parentZoneId: narrowZone.id,
        participantIds: ['left', 'right']
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: narrowZone.id,
          participantIds: ['left', 'right']
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
    'resizes for complete engagement geometry after actor-only packing succeeds in %s mode',
    (mode) => {
      const narrowZone = {
        ...zone,
        autoResize: true,
        polygon: [
          { x: 0, y: 0 },
          { x: 145, y: 0 },
          { x: 145, y: 100 },
          { x: 0, y: 100 }
        ]
      };
      const actors = [
        { ...existingActor, id: 'left' },
        { ...existingActor, id: 'right' }
      ];
      const currentEncounter = {
        ...createState(mode),
        actors: collection(actors),
        zones: collection([narrowZone])
      };
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'narrow-melee',
        parentZoneId: narrowZone.id,
        participantIds: ['left', 'right']
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: narrowZone.id,
          participantIds: ['left', 'right']
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.nextEncounter.zones.byId[narrowZone.id]?.polygon).not
        .toEqual(narrowZone.polygon);
      expect(prepared.validationResult.messages).not.toContainEqual(
        expect.objectContaining({
          code: expect.stringMatching(/^layout\.engagement/)
        })
      );
    }
  );

  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'blocks an engagement whose isolated split section cannot fit in %s mode',
    (mode) => {
      const splitZone = {
        ...zone,
        layoutStrategy: 'SPLIT_FLEX' as const,
        polygon: [
          { x: 0, y: 0 },
          { x: 190, y: 0 },
          { x: 190, y: 140 },
          { x: 0, y: 140 }
        ]
      };
      const actors = [
        { ...existingActor, id: 'engaged-hero', layoutGroup: 'hero' as const },
        { ...existingActor, id: 'engaged-enemy', layoutGroup: 'enemy' as const },
        { ...existingActor, id: 'free-hero', layoutGroup: 'hero' as const },
        { ...existingActor, id: 'free-enemy', layoutGroup: 'enemy' as const }
      ];
      const currentEncounter = {
        ...createState(mode, 'SPLIT_FLEX'),
        actors: collection(actors),
        zones: collection([splitZone])
      };
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'melee',
        parentZoneId: splitZone.id,
        participantIds: ['engaged-hero', 'engaged-enemy']
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: splitZone.id,
          participantIds: ['engaged-hero', 'engaged-enemy']
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toContainEqual(
        expect.objectContaining({
          code: 'layout.polygonFlexNoSpace',
          severity: 'error'
        })
      );
    }
  );

  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'rejects an orientation change that cannot pack the new split layout in %s mode',
    (mode) => {
      const splitZone = {
        ...zone,
        layoutStrategy: 'SPLIT_FLEX' as const,
        polygon: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 100 },
          { x: 0, y: 100 }
        ]
      };
      const splitActors = [
        { ...existingActor, id: 'hero-one', layoutGroup: 'hero' as const },
        { ...existingActor, id: 'hero-two', layoutGroup: 'hero' as const },
        { ...existingActor, id: 'enemy-one', layoutGroup: 'enemy' as const }
      ];
      const currentEncounter = {
        ...createState(mode, 'SPLIT_FLEX'),
        actors: collection(splitActors),
        zones: collection([splitZone])
      };
      const nextEncounter = updateZoneProperties(
        currentEncounter,
        splitZone.id,
        { layoutOrientation: 'TOP_BOTTOM' }
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.updateProperties', {
          properties: { layoutOrientation: 'TOP_BOTTOM' },
          zoneId: splitZone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toContainEqual(
        expect.objectContaining({
          code: 'layout.polygonFlexNoSpace',
          severity: 'error'
        })
      );
      expect(currentEncounter.zones.byId[splitZone.id]).toEqual(splitZone);
    }
  );
});
