import { describe, expect, it } from 'vitest';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, createActor, moveActor } from '@entities/actor/actorMutations';
import { createEngagement, joinEngagement } from '@entities/engagement/engagementMutations';
import { collection, createState, existingActor, zone } from './polygonFlexPlacementTestSupport';

describe('polygon auto-resize actor entry and join validation', () => {
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

  it('automatically enlarges a filled SEQUENTIAL zone for an actor entry', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      layoutStrategy: 'SEQUENTIAL' as const,
      polygon: [
        { x: 0, y: 0 },
        { x: 148, y: 0 },
        { x: 148, y: 148 },
        { x: 0, y: 148 }
      ]
    };
    const actors = ['first', 'second', 'third'].map((id) =>
      buildActor({ currentZoneId: autoResizeZone.id, id })
    );
    const enteringActor = buildActor({
      currentZoneId: ZONELESS_ACTOR_ZONE_ID,
      id: 'entering-actor'
    });
    const currentEncounter = createEngagement(
      {
        ...createState('STRICT'),
        actors: collection([...actors, enteringActor]),
        zones: collection([autoResizeZone])
      },
      {
        id: 'sequential-engagement',
        parentZoneId: autoResizeZone.id,
        participantIds: actors.map(({ id }) => id)
      }
    );
    const nextEncounter = moveActor(
      currentEncounter,
      enteringActor.id,
      autoResizeZone.id
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.move', {
        actorId: enteringActor.id,
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(false);
    expect(
      prepared.nextEncounter.zones.byId[autoResizeZone.id]?.polygon
    ).not.toEqual(autoResizeZone.polygon);
  });

  it('enlarges an already-grown zone when a large actor joins medium actors', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 59.6875, y: 63.75 },
        { x: 200.3125, y: 63.75 },
        { x: 200.3125, y: 176.25 },
        { x: 59.6875, y: 176.25 }
      ]
    };
    const mediumActors = ['medium-one', 'medium-two'].map((id) =>
      buildActor({ currentZoneId: autoResizeZone.id, id, size: 'medium' })
    );
    const currentEncounter = {
      ...createState('STRICT'),
      actors: collection(mediumActors),
      zones: collection([autoResizeZone])
    };
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: autoResizeZone.id,
      id: 'large-actor',
      size: 'large'
    });
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('actor.create', {
        actorId: 'large-actor',
        destinationZoneId: autoResizeZone.id
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.nextEncounter.zones.byId[autoResizeZone.id]?.polygon).not
      .toEqual(autoResizeZone.polygon);
    expect(prepared.blocked).toBe(false);
  });

  it('automatically enlarges an enabled zone when joining an actor moves it into the zone', () => {
    const autoResizeZone = {
      ...zone,
      autoResize: true,
      polygon: [
        { x: 0, y: 0 },
        { x: 180, y: 0 },
        { x: 180, y: 120 },
        { x: 0, y: 120 }
      ]
    };
    const participants = ['participant-one', 'participant-two'].map((id) =>
      buildActor({ currentZoneId: autoResizeZone.id, id })
    );
    const joiningActor = buildActor({
      currentZoneId: ZONELESS_ACTOR_ZONE_ID,
      id: 'joining-actor'
    });
    const currentEncounter = createEngagement(
      {
        ...createState('STRICT'),
        actors: collection([...participants, joiningActor]),
        zones: collection([autoResizeZone])
      },
      {
        id: 'target-engagement',
        parentZoneId: autoResizeZone.id,
        participantIds: participants.map(({ id }) => id)
      }
    );
    const nextEncounter = joinEngagement(
      currentEncounter,
      'target-engagement',
      [joiningActor.id]
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('engagement.join', {
        actorIds: [joiningActor.id],
        parentZoneId: autoResizeZone.id,
        targetEngagementId: 'target-engagement'
      }),
      currentEncounter,
      nextEncounter
    });

    expect(prepared.blocked).toBe(false);
    expect(
      prepared.nextEncounter.zones.byId[autoResizeZone.id]?.polygon
    ).not.toEqual(autoResizeZone.polygon);
    expect(
      prepared.nextEncounter.actors.byId[joiningActor.id]?.currentZoneId
    ).toBe(autoResizeZone.id);
  });
});
