import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { doPolygonsOverlap } from '@core/layout/polygonCollision';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createActor } from '@entities/actor/actorMutations';
import { updateZonePolygon, updateZoneProperties } from '@entities/zone/zoneMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon auto-resize geometric constraints validation', () => {
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
});
