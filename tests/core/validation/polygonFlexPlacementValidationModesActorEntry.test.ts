import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, createActor, moveActor } from '@entities/actor/actorMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon actor-entry validation modes', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'blocks an overflowing actor creation in %s mode',
    (mode) => {
      const currentEncounter = createState(mode);
      const nextEncounter = createActor(currentEncounter, {
        currentZoneId: zone.id,
        id: 'new-actor'
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.create', {
          actorId: 'new-actor',
          destinationZoneId: zone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.nextEncounter.zones.byId[zone.id]?.polygon).toEqual(
        zone.polygon
      );
      expect(prepared.validationResult.messages).toEqual([
        expect.objectContaining({
          code: 'layout.polygonFlexNoSpace',
          severity: 'error'
        })
      ]);
    }
  );

  it('allows a fitting actor creation and preserves the normal validation result', () => {
    const currentEncounter = createState('OFF');
    const roomyZone = {
      ...zone,
      id: 'roomy-zone',
      polygon: [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 200 },
        { x: 0, y: 200 }
      ]
    };
    const roomyEncounter = {
      ...currentEncounter,
      actors: collection([{ ...existingActor, currentZoneId: roomyZone.id }]),
      zones: collection([roomyZone])
    };
    const nextEncounter = createActor(roomyEncounter, {
      currentZoneId: roomyZone.id,
      id: 'new-actor'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'new-actor',
        destinationZoneId: roomyZone.id
      }),
      currentEncounter: roomyEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(false);
    expect(prepared.validationResult.valid).toBe(true);
  });

  it.each([
    'FLEX',
    'SEQUENTIAL',
    'SPLIT_FLEX',
    'SPLIT_SEQUENTIAL'
  ] as const)('blocks an overflowing actor creation in %s layouts', (layoutStrategy) => {
    const currentEncounter = createState('OFF', layoutStrategy);
    const currentZone = currentEncounter.zones.byId[zone.id]!;
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: currentZone.id,
      id: `new-${layoutStrategy}`
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: `new-${layoutStrategy}`,
        destinationZoneId: currentZone.id
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(true);
    expect(prepared.validationResult.messages).toEqual([
      expect.objectContaining({
        code: 'layout.polygonFlexNoSpace',
        severity: 'error'
      })
    ]);
  });

  it('does not resize or reject a fitting actor after a zoneless round trip', () => {
    const roomyZone = {
      ...zone,
      id: 'round-trip-zone',
      polygon: [
        { x: 0, y: 0 },
        { x: 240, y: 0 },
        { x: 240, y: 180 },
        { x: 0, y: 180 }
      ]
    };
    const secondActor = buildActor({
      currentZoneId: roomyZone.id,
      id: 'second-actor'
    });
    const thirdActor = buildActor({
      currentZoneId: roomyZone.id,
      id: 'third-actor'
    });
    const currentEncounter = {
      ...createState('OFF'),
      actors: collection([existingActor, secondActor, thirdActor]),
      zones: collection([roomyZone])
    };
    const zonelessEncounter = moveActor(
      currentEncounter,
      existingActor.id,
      'zoneless'
    );
    const returnedEncounter = moveActor(
      zonelessEncounter,
      existingActor.id,
      roomyZone.id
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.move', {
        actorIds: [existingActor.id],
        destinationZoneId: roomyZone.id
      }),
      currentEncounter: zonelessEncounter,
      nextEncounter: returnedEncounter
    });

    expect(prepared.blocked).toBe(false);
    expect(prepared.nextEncounter.zones.byId[roomyZone.id]?.polygon).toEqual(
      roomyZone.polygon
    );
  });

});
