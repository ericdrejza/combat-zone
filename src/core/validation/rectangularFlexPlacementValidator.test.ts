import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EncounterState } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import {
  buildActor,
  createActor,
  moveActor
} from '@entities/actor/actorMutations';
import { updateActorProperties } from '@entities/actor/actorMutations';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { prepareValidatedEncounterChange } from './validatedEncounterChange';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

const zone: Zone = {
  colorBorder: '#000000',
  colorFill: '#ffffff',
  id: 'tight-zone',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'Tight Zone',
  namePosition: 'top-left',
  opacity: 1,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  shape: 'rectangle',
  showBorder: true,
  showName: false,
  tags: []
};

const existingActor: Actor = buildActor({
  currentZoneId: zone.id,
  id: 'existing-actor'
});

function createState(mode: EncounterState['validationState']['mode']) {
  return {
    ...createEncounterState({ id: 'layout-validation', name: 'Layout' }),
    actors: collection([existingActor]),
    validationState: { mode, messages: [] },
    zones: collection([zone])
  };
}

describe('rectangular FLEX placement validation', () => {
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
          code: 'layout.rectangularFlexNoSpace',
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
          code: 'layout.rectangularFlexZoneResized',
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
        code: 'layout.rectangularFlexZoneResized',
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
        code: 'layout.rectangularFlexNoSpace',
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
      const roomyZone = {
        ...zone,
        polygon: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 200 },
          { x: 0, y: 200 }
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
        zone.polygon
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.reshape', {
          polygon: zone.polygon,
          zoneId: roomyZone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.requiresConfirmation).toBe(false);
      expect(prepared.validationResult.messages).toEqual([
        expect.objectContaining({
          code: 'layout.rectangularFlexZoneResized',
          severity: 'warning'
        })
      ]);
      expect(prepared.nextEncounter.zones.byId[roomyZone.id]?.polygon).not.toEqual(
        zone.polygon
      );
    }
  );
});
