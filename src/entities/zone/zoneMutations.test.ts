import { describe, expect, it } from 'vitest';

import type { Actor } from '../actor/types';
import type { Edge } from '../edge/types';
import type { Engagement } from '../engagement/types';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { calculateZoneLayout } from '@core/layout/encounterLayout';
import type { EntityCollection } from '@core/state/entityCollection';
import reducer, {
  commitEncounterChange,
  redoEncounterChange,
  undoEncounterChange
} from '@store/encounterSlice';
import type { Zone } from './types';
import {
  createZone,
  deleteZone,
  updateZonePolygon,
  updateZoneProperties
} from './zoneMutations';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    allIds: entities.map((entity) => entity.id)
  };
}

const zone: Zone = {
  colorBorder: '#9b876b',
  colorFill: '#ffffff',
  id: 'zone-room',
  name: 'Room',
  namePosition: 'top-left',
  opacity: 0.7,
  polygon: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ],
  showBorder: true,
  showName: false,
  shape: 'rectangle',
  layoutStrategy: 'FLEX',
  layoutOrientation: 'LEFT_RIGHT',
  tags: []
};

const actorInZone: Actor = {
  id: 'actor-hero',
  name: 'Hero',
  actorType: 'creature',
  layoutGroup: 'hero',
  size: 'medium',
  shape: 'circle',
  currentZoneId: zone.id,
  statusEffects: [],
  metadata: {}
};

const actorOutsideZone: Actor = {
  id: 'actor-enemy',
  name: 'Enemy',
  actorType: 'creature',
  layoutGroup: 'enemy',
  size: 'medium',
  shape: 'circle',
  currentZoneId: ZONELESS_ACTOR_ZONE_ID,
  statusEffects: [],
  metadata: {}
};

const connectedEdge: Edge = {
  id: 'edge-room-hall',
  fromZoneId: zone.id,
  toZoneId: 'zone-hall',
  directionality: 'two-way',
  movementRule: 'free',
  visibilityRule: 'clear',
  interactionTags: []
};

const unrelatedEdge: Edge = {
  ...connectedEdge,
  id: 'edge-other',
  fromZoneId: 'zone-hall',
  toZoneId: 'zone-yard'
};

const engagementInZone: Engagement = {
  id: 'engagement-room',
  participantIds: ['actor-hero', 'actor-enemy'],
  parentZoneId: zone.id,
  layoutStrategy: 'SEQUENTIAL',
  layoutOrientation: 'LEFT_RIGHT'
};

function createZoneEncounterState() {
  return {
    ...createEncounterState({
      id: 'encounter-zones',
      name: 'Zone Encounter'
    }),
    zones: collection([zone]),
    actors: collection([actorInZone, actorOutsideZone]),
    edges: collection([connectedEdge, unrelatedEdge]),
    engagements: collection([engagementInZone])
  };
}

function commitState(
  state: ReturnType<typeof reducer>,
  type: string,
  nextEncounter: ReturnType<typeof createZoneEncounterState>
) {
  return reducer(
    state,
    commitEncounterChange({
      action: createEncounterActionRecord(type),
      nextEncounter
    })
  );
}

describe('zone mutations', () => {
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
      tags: ['difficult', 'lit']
    });

    state = commitState(state, 'zone.updateProperties', nextEncounter);

    expect(state.present.zones.byId[zone.id]).toMatchObject({
      layoutOrientation: 'TOP_BOTTOM',
      layoutStrategy: 'SPLIT_SEQUENTIAL',
      name: 'Updated Room',
      tags: ['difficult', 'lit']
    });
    expect(
      calculateZoneLayout(state.present, zone.id).descriptor
    ).toMatchObject({
      orientation: 'TOP_BOTTOM',
      strategy: 'SPLIT_SEQUENTIAL',
      sections: [
        { id: 'hero', items: [{ id: 'actor-hero', layoutGroup: 'hero' }] },
        {
          id: 'neutral',
          items: [{ id: 'engagement-room', layoutGroup: 'neutral' }]
        },
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
  });

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
