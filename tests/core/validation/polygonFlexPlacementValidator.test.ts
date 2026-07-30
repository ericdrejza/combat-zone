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
import {
  createEngagement,
  joinEngagement
} from '@entities/engagement/engagementMutations';
import { updateActorProperties } from '@entities/actor/actorMutations';
import {
  updateZonePolygon,
  updateZoneProperties
} from '@entities/zone/zoneMutations';
import { doPolygonsOverlap } from '@core/layout/polygonCollision';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';

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

function createState(
  mode: EncounterState['validationState']['mode'],
  layoutStrategy: Zone['layoutStrategy'] = 'FLEX'
) {
  return {
    ...createEncounterState({ id: 'layout-validation', name: 'Layout' }),
    actors: collection([existingActor]),
    validationState: { mode, messages: [] },
    zones: collection([{ ...zone, layoutStrategy }])
  };
}

describe('polygon placement validation', () => {
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
          { x: 270, y: 0 },
          { x: 270, y: 270 },
          { x: 0, y: 270 }
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

  it('expands an auto-resizing zone before accepting a new split orientation', () => {
    const splitZone = {
      ...zone,
      autoResize: true,
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
      ...createState('OFF', 'SPLIT_FLEX'),
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
    const resizedPolygon = prepared.nextEncounter.zones.byId[splitZone.id]
      ?.polygon;

    expect(prepared.blocked).toBe(false);
    expect(resizedPolygon).toBeDefined();
    expect(resizedPolygon![2].y - resizedPolygon![0].y).toBeGreaterThan(100);
    expect(prepared.validationResult.messages).toContainEqual(
      expect.objectContaining({
        code: 'layout.polygonFlexZoneResized',
        severity: 'warning'
      })
    );
  });

  it('blocks a compact dense FLEX resize that would make actors touch', () => {
    const roomyZone = {
      ...zone,
      polygon: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 400, y: 220 },
        { x: 0, y: 220 }
      ]
    };
    const denseActors = Array.from({ length: 8 }, (_, index) => ({
      ...existingActor,
      id: `dense-${index}`
    }));
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection(denseActors),
      zones: collection([roomyZone])
    };
    const compactPolygon = [
      { x: 0, y: 0 },
      { x: 250, y: 0 },
      { x: 250, y: 130 },
      { x: 0, y: 130 }
    ];
    const nextEncounter = updateZonePolygon(
      currentEncounter,
      roomyZone.id,
      compactPolygon
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('zone.reshape', {
        polygon: compactPolygon,
        resizeAnchor: { x: 400, y: 220 },
        zoneId: roomyZone.id
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(true);
    expect(prepared.nextEncounter.zones.byId[roomyZone.id]?.polygon).toEqual(
      compactPolygon
    );
  });

  it('stops a blocked rectangle side while continuing expansion on other sides', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 100 },
        { x: 0, y: 100 }
      ]
    };
    const neighboringZone = {
      ...zone,
      id: 'neighboring-zone',
      name: 'Neighboring Zone',
      polygon: [
        { x: 125, y: 0 },
        { x: 225, y: 0 },
        { x: 225, y: 100 },
        { x: 125, y: 100 }
      ]
    };
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection([{ ...existingActor, currentZoneId: autoResizeZone.id }]),
      zones: collection([autoResizeZone, neighboringZone])
    };
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: autoResizeZone.id,
      id: 'new-actor'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'new-actor',
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });
    const resizedPolygon = prepared.nextEncounter.zones.byId[autoResizeZone.id]
      ?.polygon;

    expect(prepared.blocked).toBe(false);
    expect(resizedPolygon).toBeDefined();
    expect(Math.max(...resizedPolygon!.map((point) => point.x))).toBeCloseTo(125, 3);
    expect(
      doPolygonsOverlap(resizedPolygon!, neighboringZone.polygon)
    ).toBe(false);
    expect(prepared.validationResult.messages).not.toContainEqual(
      expect.objectContaining({ code: 'zone.overlap' })
    );
  });

  it('expands horizontally when zones block both vertical directions', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 }
      ]
    };
    const aboveZone = {
      ...zone,
      id: 'above-zone',
      name: 'Above Zone',
      polygon: [
        { x: 100, y: 0 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 100, y: 100 }
      ]
    };
    const belowZone = {
      ...zone,
      id: 'below-zone',
      name: 'Below Zone',
      polygon: [
        { x: 100, y: 200 },
        { x: 200, y: 200 },
        { x: 200, y: 300 },
        { x: 100, y: 300 }
      ]
    };
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection([{ ...existingActor, currentZoneId: autoResizeZone.id }]),
      zones: collection([autoResizeZone, aboveZone, belowZone])
    };
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: autoResizeZone.id,
      id: 'horizontal-actor'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'horizontal-actor',
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });
    const resizedPolygon = prepared.nextEncounter.zones.byId[autoResizeZone.id]
      ?.polygon;
    const bounds = {
      minX: Math.min(...resizedPolygon!.map((point) => point.x)),
      maxX: Math.max(...resizedPolygon!.map((point) => point.x)),
      minY: Math.min(...resizedPolygon!.map((point) => point.y)),
      maxY: Math.max(...resizedPolygon!.map((point) => point.y))
    };

    expect(prepared.blocked).toBe(false);
    expect(bounds.minX).toBeLessThan(100);
    expect(bounds.maxX).toBeGreaterThan(200);
    expect(bounds.minY).toBeCloseTo(100, 3);
    expect(bounds.maxY).toBeCloseTo(200, 3);
    expect(resizedPolygon).toEqual([
      { x: bounds.minX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY },
      { x: bounds.minX, y: bounds.maxY }
    ]);
    expect(prepared.validationResult.messages).not.toContainEqual(
      expect.objectContaining({ code: 'zone.overlap' })
    );
  });

  it('keeps automatic expansion inside the canvas bounds', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 }
      ]
    };
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection([{ ...existingActor, currentZoneId: autoResizeZone.id }]),
      zones: collection([autoResizeZone])
    };
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: autoResizeZone.id,
      id: 'canvas-edge-actor'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'canvas-edge-actor',
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });
    const resizedPolygon = prepared.nextEncounter.zones.byId[autoResizeZone.id]
      ?.polygon;

    expect(prepared.blocked).toBe(false);
    expect(resizedPolygon).toBeDefined();
    expect(resizedPolygon).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ x: 0 }),
        expect.objectContaining({ y: 0 })
      ])
    );
    expect(resizedPolygon!.every(
      (point) => point.x >= 0 && point.x <= 960 && point.y >= 0 && point.y <= 640
    )).toBe(true);
  });

  it('automatically enlarges an enabled zone for an overflowing actor creation', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 0, y: 0 },
        { x: 120, y: 0 },
        { x: 120, y: 100 },
        { x: 0, y: 100 }
      ]
    };
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection([{ ...existingActor, currentZoneId: autoResizeZone.id }]),
      zones: collection([autoResizeZone])
    };
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: autoResizeZone.id,
      id: 'new-actor'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'new-actor',
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });
    const resizedPolygon = prepared.nextEncounter.zones.byId[autoResizeZone.id]
      ?.polygon;
    const requestedWidth = 120;
    const requestedHeight = 100;
    const resizedWidth = (resizedPolygon?.[1].x ?? 0) - (resizedPolygon?.[0].x ?? 0);
    const resizedHeight = (resizedPolygon?.[2].y ?? 0) - (resizedPolygon?.[1].y ?? 0);

    expect(prepared.blocked).toBe(false);
    expect(prepared.nextEncounter.actors.byId['new-actor']).toBeDefined();
    expect(resizedPolygon).not.toEqual(autoResizeZone.polygon);
    expect(resizedWidth / resizedHeight).toBeCloseTo(
      requestedWidth / requestedHeight
    );
    expect(prepared.validationResult.messages).toEqual([
      expect.objectContaining({
        code: 'layout.polygonFlexZoneResized',
        severity: 'warning'
      })
    ]);
  });

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
