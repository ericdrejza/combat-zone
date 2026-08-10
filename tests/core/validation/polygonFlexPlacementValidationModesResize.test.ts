import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, updateActorProperties } from '@entities/actor/actorMutations';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon resize validation modes', () => {
  it.each(['OFF', 'ADVISORY'] as const)(
    'automatically resizes the zone for an actor resize in %s mode',
    (mode) => {
      const currentEncounter = createState(mode);
      const nextEncounter = updateActorProperties(
        currentEncounter,
        existingActor.id,
        { size: 'xLarge' }
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.updateProperties', {
          actorId: existingActor.id,
          properties: { size: 'xLarge' }
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.requiresConfirmation).toBe(false);
      expect(prepared.validationResult.messages).toEqual([
        expect.objectContaining({
          code: 'layout.polygonFlexZoneResized',
          severity: 'warning'
        })
      ]);
      expect(prepared.nextEncounter.zones.byId[zone.id]?.polygon).not.toEqual(
        zone.polygon
      );
    }
  );

  it('requires confirmation for an assisted actor resize', () => {
    const currentEncounter = createState('ASSISTED');
    const nextEncounter = updateActorProperties(
      currentEncounter,
      existingActor.id,
      { size: 'xLarge' }
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.updateProperties', {
        actorId: existingActor.id,
        properties: { size: 'xLarge' }
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(true);
    expect(prepared.requiresConfirmation).toBe(true);
    expect(prepared.validationResult.messages).toEqual([
      expect.objectContaining({
        code: 'layout.polygonFlexZoneResized',
        severity: 'warning'
      })
    ]);
    expect(prepared.nextEncounter.zones.byId[zone.id]?.polygon).not.toEqual(
      zone.polygon
    );
  });

  it('does not resize an actor in STRICT mode', () => {
    const currentEncounter = createState('STRICT');
    const nextEncounter = updateActorProperties(
      currentEncounter,
      existingActor.id,
      { size: 'xLarge' }
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.updateProperties', {
        actorId: existingActor.id,
        properties: { size: 'xLarge' }
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(true);
    expect(prepared.requiresConfirmation).toBe(false);
    expect(prepared.validationResult.messages).toEqual([
      expect.objectContaining({
        code: 'layout.polygonFlexNoSpace',
        severity: 'error'
      })
    ]);
    expect(prepared.nextEncounter.zones.byId[zone.id]?.polygon).toEqual(
      zone.polygon
    );
  });

  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'automatically resizes a zone that cannot fit its actors in %s mode',
    (mode) => {
      const smallPolygon = [
        { x: 200, y: 200 },
        { x: 300, y: 200 },
        { x: 300, y: 300 },
        { x: 200, y: 300 }
      ];
      const roomyZone = {
        ...zone,
        polygon: [
          { x: 200, y: 200 },
          { x: 500, y: 200 },
          { x: 500, y: 400 },
          { x: 200, y: 400 }
        ]
      };
      const secondActor = buildActor({
        currentZoneId: roomyZone.id,
        id: 'second-actor'
      });
      const currentEncounter = {
        ...createState(mode),
        actors: collection([existingActor, secondActor]),
        zones: collection([roomyZone])
      };
      const nextEncounter = updateZonePolygon(
        currentEncounter,
        roomyZone.id,
        smallPolygon
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.reshape', {
          polygon: smallPolygon,
          resizeAnchor: { x: 300, y: 300 },
          zoneId: roomyZone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.requiresConfirmation).toBe(false);
      expect(prepared.validationResult.messages).toEqual([
        expect.objectContaining({
          code: 'layout.polygonFlexZoneResized',
          severity: 'warning'
        })
      ]);
      expect(prepared.nextEncounter.zones.byId[roomyZone.id]?.polygon).not.toEqual(
        smallPolygon
      );
      expect(prepared.nextEncounter.zones.byId[roomyZone.id]?.polygon).toContainEqual({
        x: 300,
        y: 300
      });
    }
  );
});
