import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { toNestingActor } from '@core/layout/actorFootprints';
import { packPolygonFlexActors } from '@core/layout/polygonFlexLayout';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createActor } from '@entities/actor/actorMutations';
import { updateZonePolygon } from '@entities/zone/zoneMutations';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import {
  ACTOR_COUNT,
  createActors,
  createEncounter,
  expectUnderTarget,
  expectValidSpread,
  measure,
  ROOMY_POLYGON,
  UNDERSIZED_POLYGON,
  ZONE_ID
} from './actorPackingPerformanceFixtures';

describe('50-actor CPU performance', () => {
  it('keeps direct FLEX packing deterministic, contained, non-overlapping, and spread', () => {
    const actors = createActors(ACTOR_COUNT);
    const input = {
      actors: actors.map(toNestingActor),
      polygon: ROOMY_POLYGON
    };
    const { result, timing } = measure(() => packPolygonFlexActors(input));

    expect(result.placements).toEqual(packPolygonFlexActors(input).placements);
    expectValidSpread(actors, result);
    expectUnderTarget('direct FLEX pack (50 actors)', timing);
  });

  it('derives render geometry efficiently for a populated FLEX zone', () => {
    const encounter = createEncounter(ACTOR_COUNT);
    const { result, timing } = measure(() =>
      calculateActorPlacementGeometry(encounter, [ZONE_ID])
    );

    expect(result).toHaveLength(ACTOR_COUNT);
    expect(new Set(result.map((placement) => placement.actorId)).size).toBe(
      ACTOR_COUNT
    );
    expectUnderTarget('derived FLEX geometry (50 actors)', timing);
  });

  it('validates adding the fiftieth actor to a crowded static zone efficiently', () => {
    const currentEncounter = createEncounter(ACTOR_COUNT - 1);
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: ZONE_ID,
      id: `actor-${ACTOR_COUNT - 1}`,
      layoutGroup: 'enemy',
      shape: 'circle',
      size: 'medium'
    });
    const action = createEncounterActionRecord('actor.create', {
      actorId: `actor-${ACTOR_COUNT - 1}`,
      destinationZoneId: ZONE_ID
    });
    const { result, timing } = measure(() =>
      prepareValidatedEncounterChange({
        action,
        currentEncounter,
        nextEncounter
      })
    );

    expect(
      result.blocked,
      JSON.stringify(result.validationResult.messages)
    ).toBe(false);
    expect(result.nextEncounter.zones.byId[ZONE_ID]?.polygon).toEqual(
      ROOMY_POLYGON
    );
    expectUnderTarget('static-zone actor add (50 actors)', timing);
  });

  it('automatically resizes a crowded zone after adding the fiftieth actor', () => {
    const currentEncounter = createEncounter(
      ACTOR_COUNT - 1,
      UNDERSIZED_POLYGON,
      true
    );
    const nextEncounter = createActor(currentEncounter, {
      currentZoneId: ZONE_ID,
      id: `actor-${ACTOR_COUNT - 1}`,
      layoutGroup: 'enemy',
      shape: 'circle',
      size: 'medium'
    });
    const action = createEncounterActionRecord('actor.create', {
      actorId: `actor-${ACTOR_COUNT - 1}`,
      destinationZoneId: ZONE_ID
    });
    const { result, timing } = measure(() =>
      prepareValidatedEncounterChange({
        action,
        currentEncounter,
        nextEncounter
      })
    );

    expect(
      result.blocked,
      JSON.stringify(result.validationResult.messages)
    ).toBe(false);
    expect(result.nextEncounter.zones.byId[ZONE_ID]?.polygon).not.toEqual(
      UNDERSIZED_POLYGON
    );
    expectUnderTarget('automatic zone resize on actor add (50 actors)', timing);
  }, 30_000);

  it('corrects an undersized manual reshape with 50 actors efficiently', () => {
    const currentEncounter = createEncounter(ACTOR_COUNT);
    const nextEncounter = updateZonePolygon(
      currentEncounter,
      ZONE_ID,
      UNDERSIZED_POLYGON
    );
    const action = createEncounterActionRecord('zone.reshape', {
      polygon: UNDERSIZED_POLYGON,
      resizeAnchor: UNDERSIZED_POLYGON[0],
      zoneId: ZONE_ID
    });
    const { result, timing } = measure(() =>
      prepareValidatedEncounterChange({
        action,
        currentEncounter,
        nextEncounter
      })
    );

    expect(result.blocked).toBe(false);
    expect(result.nextEncounter.zones.byId[ZONE_ID]?.polygon).not.toEqual(
      UNDERSIZED_POLYGON
    );
    expectUnderTarget('manual dynamic zone resize (50 actors)', timing);
  }, 30_000);
});
