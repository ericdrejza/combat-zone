import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { getMinimumZoneHeight, getMinimumZoneWidth } from '@core/validation/zoneSize';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import type { Zone } from '@entities/zone/types';
import { createZone, updateZonePolygon } from '@entities/zone/zoneMutations';

const baseZone: Zone = {
  colorBorder: '#000000',
  colorFill: '#ffffff',
  id: 'zone-one',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'Zone One',
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

function createState(mode: 'OFF' | 'ADVISORY' | 'ASSISTED' | 'STRICT') {
  const state = createEncounterState({ id: 'encounter-one', name: 'Encounter' });

  return {
    ...state,
    validationState: { messages: [], mode },
    zones: {
      allIds: [baseZone.id],
      byId: { [baseZone.id]: baseZone }
    }
  };
}

const undersizedPolygon = [
  { x: 0, y: 0 },
  { x: getMinimumZoneWidth() - 1, y: 0 },
  { x: getMinimumZoneWidth() - 1, y: getMinimumZoneHeight() - 1 },
  { x: 0, y: getMinimumZoneHeight() - 1 }
];

describe('zone size validation', () => {
  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'blocks undersized zone creation in %s mode',
    (mode) => {
      const currentEncounter = createState(mode);
      const nextEncounter = createZone(currentEncounter, {
        id: 'new-zone',
        polygon: undersizedPolygon,
        shape: 'rectangle'
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.create', {
          polygon: undersizedPolygon,
          shape: 'rectangle',
          zoneId: 'new-zone'
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toEqual([
        expect.objectContaining({
          code: 'zone.minimumSize',
          severity: 'error'
        })
      ]);
    }
  );

  it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)(
    'corrects undersized zone resizing in %s mode',
    (mode) => {
      const currentEncounter = createState(mode);
      const nextEncounter = updateZonePolygon(
        currentEncounter,
        baseZone.id,
        undersizedPolygon
      );
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.reshape', {
          polygon: undersizedPolygon,
          resizeAnchor: { x: 0, y: 0 },
          zoneId: baseZone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(false);
      expect(prepared.validationResult.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'zone.minimumSize',
            severity: 'warning'
          })
        ])
      );
      expect(prepared.nextEncounter.zones.byId[baseZone.id]?.polygon).toEqual([
        { x: 0, y: 0 },
        { x: getMinimumZoneWidth(), y: 0 },
        { x: getMinimumZoneWidth(), y: getMinimumZoneHeight() },
        { x: 0, y: getMinimumZoneHeight() }
      ]);
    }
  );

  it('allows a zone whose dimensions equal the small actor footprint', () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: getMinimumZoneWidth(), y: 0 },
      { x: getMinimumZoneWidth(), y: getMinimumZoneHeight() },
      { x: 0, y: getMinimumZoneHeight() }
    ];
    const currentEncounter = createState('STRICT');
    const nextEncounter = createZone(currentEncounter, {
      id: 'minimum-zone',
      polygon,
      shape: 'rectangle'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('zone.create', {
        polygon,
        shape: 'rectangle',
        zoneId: 'minimum-zone'
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(false);
    expect(prepared.validationResult.messages).not.toContainEqual(
      expect.objectContaining({ code: 'zone.minimumSize' })
    );
  });
});
