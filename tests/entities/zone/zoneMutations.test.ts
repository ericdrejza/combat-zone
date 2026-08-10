import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { calculateZoneLayout } from '@core/layout/encounterLayout';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import reducer, {
  redoEncounterChange,
  undoEncounterChange
} from '@store/encounterSlice';
import {
  createZone,
  deleteZone,
  updateZonePolygon,
  updateZoneProperties
} from '@entities/zone/zoneMutations';
import {
  collection,
  commitState,
  createZoneEncounterState,
  unrelatedEdge,
  zone
} from './zoneMutationTestSupport';

describe('zone mutations', () => {
  describe('create, reshape, and properties', () => {
    it('creates a polygon zone and restores it through undo and redo', () => {
    const initialState = reducer(undefined, { type: 'test/init' });
    const polygon = [
      { x: 10, y: 10 },
      { x: 120, y: 10 },
      { x: 120, y: 90 },
      { x: 10, y: 90 }
    ];
    const nextEncounter = createZone(initialState.present, {
      id: 'zone-created',
      name: 'Created',
      polygon
    });
    let state = commitState(initialState, 'zone.create', nextEncounter);

    expect(state.present.zones.byId['zone-created']).toMatchObject({
      name: 'Created',
      polygon
    });

    state = reducer(state, undoEncounterChange());
    expect(state.present).toEqual(initialState.present);

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(nextEncounter);
    });

    it('reshapes a zone polygon and restores the exact previous polygon on undo', () => {
    const initialState = reducer(undefined, { type: 'test/init' });
    const baseEncounter = createZoneEncounterState();
    let state = commitState(initialState, 'test.seed', baseEncounter);
    const polygon = [
      { x: 5, y: 5 },
      { x: 140, y: 0 },
      { x: 120, y: 110 },
      { x: 0, y: 100 }
    ];
    const reshapedEncounter = updateZonePolygon(
      state.present,
      zone.id,
      polygon
    );

    state = commitState(state, 'zone.reshape', reshapedEncounter);

    expect(state.present.zones.byId[zone.id]?.polygon).toEqual(polygon);

    state = reducer(state, undoEncounterChange());
    expect(state.present.zones.byId[zone.id]?.polygon).toEqual(zone.polygon);

    state = reducer(state, redoEncounterChange());
    expect(state.present.zones.byId[zone.id]?.polygon).toEqual(polygon);
    });

    it('updates zone properties and immediately changes the derived layout descriptor', () => {
    const initialState = reducer(undefined, { type: 'test/init' });
    const baseEncounter = createZoneEncounterState();
    let state = commitState(initialState, 'test.seed', baseEncounter);
    const nextEncounter = updateZoneProperties(state.present, zone.id, {
      layoutOrientation: 'TOP_BOTTOM',
      layoutStrategy: 'SPLIT_SEQUENTIAL',
      name: 'Updated Room',
      showSectionDividers: true,
      tags: ['difficult', 'lit']
    });

    state = commitState(state, 'zone.updateProperties', nextEncounter);

    expect(state.present.zones.byId[zone.id]).toMatchObject({
      layoutOrientation: 'TOP_BOTTOM',
      layoutStrategy: 'SPLIT_SEQUENTIAL',
      name: 'Updated Room',
      showSectionDividers: true,
      tags: ['difficult', 'lit']
    });
    expect(
      calculateZoneLayout(state.present, zone.id).descriptor
    ).toMatchObject({
      orientation: 'TOP_BOTTOM',
      strategy: 'SPLIT_SEQUENTIAL',
      sections: [
        { id: 'hero', items: [] },
        {
          id: 'engagement-engagement-room',
          items: [
            { id: 'engagement-room', layoutGroup: 'neutral' },
            { id: 'actor-hero', layoutGroup: 'hero' }
          ]
        },
        { id: 'neutral', items: [] },
        { id: 'enemy', items: [] }
      ]
    });

    state = reducer(state, undoEncounterChange());
    expect(
      calculateZoneLayout(state.present, zone.id).descriptor
    ).toMatchObject({
      orientation: 'LEFT_RIGHT',
      strategy: 'FLEX'
    });
    expect(
      state.present.zones.byId[zone.id]?.showSectionDividers
    ).toBeUndefined();

    state = reducer(state, redoEncounterChange());
    expect(
      state.present.zones.byId[zone.id]?.showSectionDividers
    ).toBe(true);
    });

    it.each(['ADVISORY', 'STRICT'] as const)(
      'allows divider visibility changes in %s validation mode',
      (mode) => {
      const emptyEncounter = createEncounterState({
        id: 'encounter-divider-validation',
        name: 'Divider validation'
      });
      const currentEncounter = {
        ...emptyEncounter,
        zones: collection([zone]),
        validationState: {
          ...emptyEncounter.validationState,
          mode
        }
      };
      const nextEncounter = updateZoneProperties(
        currentEncounter,
        zone.id,
        { showSectionDividers: true }
      );
      const result = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('zone.updateProperties', {
          properties: { showSectionDividers: true },
          zoneId: zone.id
        }),
        currentEncounter,
        nextEncounter
      });

      expect(result.blocked).toBe(false);
      expect(
        result.nextEncounter.zones.byId[zone.id]?.showSectionDividers
      ).toBe(true);
      }
    );
  });

  describe('delete and cascade', () => {
    it('deletes a zone as one reversible history entry with actor, edge, and engagement cascades', () => {
    const initialState = reducer(undefined, { type: 'test/init' });
    const baseEncounter = createZoneEncounterState();
    let state = commitState(initialState, 'test.seed', baseEncounter);
    const deletedEncounter = deleteZone(state.present, zone.id);

    state = commitState(state, 'zone.delete', deletedEncounter);

    expect(state.present.zones.byId[zone.id]).toBeUndefined();
    expect(state.present.actors.byId['actor-hero']?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
    expect(state.present.actors.byId['actor-enemy']?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
    expect(state.present.edges.byId['edge-room-hall']).toBeUndefined();
    expect(state.present.edges.byId['edge-other']).toEqual(unrelatedEdge);
    expect(state.present.engagements.byId['engagement-room']).toBeUndefined();

    state = reducer(state, undoEncounterChange());
    expect(state.present).toEqual(baseEncounter);

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(deletedEncounter);
    });
  });
});
