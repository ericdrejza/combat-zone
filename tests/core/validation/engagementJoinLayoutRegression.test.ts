import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { getActorRadius } from '@core/layout/actorFootprints';
import { packEngagementParticipants } from '@core/layout/engagementPacking';
import type { EntityCollection } from '@core/state/entityCollection';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor } from '@entities/actor/actorMutations';
import {
  createEngagement,
  joinEngagement
} from '@entities/engagement/engagementMutations';
import type { Zone } from '@entities/zone/types';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('engagement join layout regression', () => {
  it('accepts the screenshot mixed-size engagement growth when its lines fit', () => {
    const zone: Zone = {
      colorBorder: '#000000',
      colorFill: '#ffffff',
      id: 'zone',
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      name: 'Screenshot zone',
      namePosition: 'top-left',
      opacity: 1,
      polygon: [
        { x: 0, y: 0 },
        { x: 405, y: 0 },
        { x: 405, y: 288 },
        { x: 0, y: 288 }
      ],
      shape: 'rectangle',
      showBorder: true,
      showName: false,
      tags: []
    };
    const actorSizes = [
      'medium',
      'large',
      'medium',
      'large',
      'medium',
      'small',
      'medium',
      'medium'
    ] as const;
    const actors = actorSizes.map((size, index) =>
      buildActor({ currentZoneId: zone.id, id: `actor-${index}`, size })
    );
    const baseEncounter = {
      ...createEncounterState({
        id: 'join-regression',
        name: 'Join regression'
      }),
      actors: collection(actors),
      zones: collection([zone])
    };
    const currentEncounter = createEngagement(baseEncounter, {
      id: 'melee',
      parentZoneId: zone.id,
      participantIds: actors.slice(0, 6).map(({ id }) => id)
    });
    const joiningIds = actors.slice(6).map(({ id }) => id);
    const nextEncounter = joinEngagement(
      currentEncounter,
      'melee',
      joiningIds
    );
    const screenshotPoints = [
      { x: 110, y: 86 },
      { x: 202, y: 65 },
      { x: 66, y: 137 },
      { x: 202, y: 222 },
      { x: 295, y: 203 },
      { x: 338, y: 150 },
      { x: 306, y: 82 },
      { x: 82, y: 225 }
    ];
    const visiblePacking = packEngagementParticipants(
      nextEncounter,
      actors.map((actor, index) => ({
        actorId: actor.id,
        point: screenshotPoints[index],
        radius: getActorRadius(actor),
        shape: actor.shape
      }))
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('engagement.join', {
        actorIds: joiningIds,
        parentZoneId: zone.id,
        targetEngagementId: 'melee'
      }),
      currentEncounter,
      nextEncounter
    });

    expect(visiblePacking.fits).toBe(true);
    expect(prepared.validationResult.messages).toEqual([]);
    expect(prepared.blocked).toBe(false);
  });

  it('accepts joining the larger right engagement without trapping the left group', () => {
    const zone: Zone = {
      colorBorder: '#000000',
      colorFill: '#ffffff',
      id: 'two-groups-zone',
      layoutOrientation: 'LEFT_RIGHT',
      layoutStrategy: 'FLEX',
      name: 'Two groups zone',
      namePosition: 'top-left',
      opacity: 1,
      polygon: [
        { x: 0, y: 0 },
        { x: 402, y: 0 },
        { x: 402, y: 240 },
        { x: 0, y: 240 }
      ],
      shape: 'rectangle',
      showBorder: true,
      showName: false,
      tags: []
    };
    const actorInputs = [
      ['left-top', 'medium'],
      ['left-bottom', 'medium'],
      ['right-top', 'medium'],
      ['right-bottom-left', 'large'],
      ['right-bottom-right', 'large'],
      ['joining-right', 'medium']
    ] as const;
    const actors = actorInputs.map(([id, size]) =>
      buildActor({ currentZoneId: zone.id, id, size })
    );
    const baseEncounter = {
      ...createEncounterState({ id: 'two-groups', name: 'Two groups' }),
      actors: collection(actors),
      zones: collection([zone])
    };
    const withLeft = createEngagement(baseEncounter, {
      id: 'left',
      parentZoneId: zone.id,
      participantIds: ['left-top', 'left-bottom']
    });
    const currentEncounter = createEngagement(withLeft, {
      id: 'right',
      parentZoneId: zone.id,
      participantIds: [
        'right-top',
        'right-bottom-left',
        'right-bottom-right'
      ]
    });
    const nextEncounter = joinEngagement(currentEncounter, 'right', [
      'joining-right'
    ]);
    const screenshotPoints = [
      { x: 65, y: 49 },
      { x: 65, y: 180 },
      { x: 334, y: 33 },
      { x: 196, y: 172 },
      { x: 334, y: 172 },
      { x: 264, y: 62 }
    ];
    const visiblePacking = packEngagementParticipants(
      nextEncounter,
      actors.map((actor, index) => ({
        actorId: actor.id,
        point: screenshotPoints[index],
        radius: getActorRadius(actor),
        shape: actor.shape
      }))
    );
    const visibleById = new Map(
      actors.map((actor, index) => [actor.id, {
        actorId: actor.id,
        point: screenshotPoints[index],
        radius: getActorRadius(actor),
        shape: actor.shape
      }])
    );
    const prepared = prepareValidatedEncounterChange({
      action: createEncounterActionRecord('engagement.join', {
        actorIds: ['joining-right'],
        parentZoneId: zone.id,
        targetEngagementId: 'right'
      }),
      currentEncounter,
      nextEncounter
    });

    expect(visiblePacking.fits).toBe(true);
    expect(prepared.validationResult.messages).toEqual([]);
    expect(prepared.blocked).toBe(false);
  });
});
