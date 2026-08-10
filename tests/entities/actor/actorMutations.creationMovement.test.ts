import { describe, expect, it } from 'vitest';

import { ZONELESS_ACTOR_ZONE_ID } from '@core/encounter/types';
import { calculateZoneLayout } from '@core/layout/encounterLayout';
import reducer, {
  redoEncounterChange,
  undoEncounterChange
} from '@store/encounterSlice';
import {
  createActor,
  moveActor
} from '@entities/actor/actorMutations';
import type { Actor } from '@entities/actor/types';
import {
  actor,
  collection,
  commitState,
  createActorEncounterState,
  zoneA,
  zoneB
} from './actorMutationsTestSupport';

describe('actor mutations', () => {
  it('inherits the uploaded image name when no actor name is provided', () => {
    const nextEncounter = createActor(createActorEncounterState(), {
      currentZoneId: zoneA.id,
      id: 'actor-named-token',
      image: {
        dataUrl: 'data:image/png;base64,token',
        mediaType: 'image/png',
        name: 'Goblin Captain.final.png'
      }
    });

    expect(nextEncounter.actors.byId['actor-named-token']?.name).toBe(
      'Goblin Captain.final.png'
    );
    expect(
      nextEncounter.actors.byId['actor-named-token']?.metadata.sourceAssetName
    ).toBe('Goblin Captain.final.png');
  });

  it('creates actors in zones and as zoneless actors with undo and redo', () => {
    const initialHistory = reducer(undefined, { type: 'test/init' });
    let state = commitState(
      initialHistory,
      'test.seed',
      createActorEncounterState()
    );
    const withZoneActor = createActor(state.present, {
      currentZoneId: zoneA.id,
      id: 'actor-token',
      image: {
        dataUrl: 'data:image/png;base64,token',
        mediaType: 'image/png',
        name: 'token.png'
      },
      layoutGroup: 'enemy',
      shape: 'rectangle',
      size: 'large'
    });

    state = commitState(state, 'actor.create', withZoneActor);

    expect(state.present.actors.byId['actor-token']).toMatchObject({
      currentZoneId: zoneA.id,
      image: 'data:image/png;base64,token',
      layoutGroup: 'enemy',
      shape: 'rectangle',
      size: 'large'
    });

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId['actor-token']).toBeUndefined();

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(withZoneActor);

    const withZonelessActor = createActor(state.present, {
      currentZoneId: ZONELESS_ACTOR_ZONE_ID,
      id: 'actor-zoneless'
    });

    state = commitState(state, 'actor.create', withZonelessActor);
    expect(state.present.actors.byId['actor-zoneless']?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
  });

  it('moves actors between zones and to zoneless state with exact undo and redo', () => {
    const initialHistory = reducer(undefined, { type: 'test/init' });
    let state = commitState(
      initialHistory,
      'test.seed',
      createActorEncounterState()
    );
    const movedEncounter = moveActor(state.present, actor.id, zoneB.id);

    state = commitState(state, 'actor.move', movedEncounter);

    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(zoneB.id);
    expect(
      calculateZoneLayout(state.present, zoneA.id).descriptor.sections[0].items
    ).toEqual([]);
    expect(
      calculateZoneLayout(state.present, zoneB.id).descriptor.sections[0].items
    ).toEqual([{ id: actor.id, layoutGroup: 'hero' }]);

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(zoneA.id);

    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(movedEncounter);

    const zonelessEncounter = moveActor(
      state.present,
      actor.id,
      ZONELESS_ACTOR_ZONE_ID
    );

    state = commitState(state, 'actor.move', zonelessEncounter);
    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );
  });

  it('appends an actor when it leaves and re-enters a zone', () => {
    const secondActor: Actor = {
      ...actor,
      id: 'actor-second-hero',
      name: 'Second Hero'
    };
    const baseEncounter = {
      ...createActorEncounterState(),
      actors: collection([actor, secondActor])
    };
    const initialHistory = reducer(undefined, { type: 'test/init' });
    let state = commitState(initialHistory, 'test.seed', baseEncounter);

    const zonelessEncounter = moveActor(
      state.present,
      actor.id,
      ZONELESS_ACTOR_ZONE_ID
    );
    state = commitState(state, 'actor.move', zonelessEncounter);

    expect(state.present.actors.allIds).toEqual([
      secondActor.id,
      actor.id
    ]);
    expect(
      calculateZoneLayout(state.present, zoneA.id).descriptor.sections[0].items
    ).toEqual([{ id: secondActor.id, layoutGroup: 'hero' }]);

    const reenteredEncounter = moveActor(
      state.present,
      actor.id,
      zoneA.id
    );
    state = commitState(state, 'actor.move', reenteredEncounter);

    expect(state.present.actors.allIds).toEqual([
      secondActor.id,
      actor.id
    ]);
    expect(
      calculateZoneLayout(state.present, zoneA.id).descriptor.sections[0].items
    ).toEqual([
      { id: secondActor.id, layoutGroup: 'hero' },
      { id: actor.id, layoutGroup: 'hero' }
    ]);

    state = reducer(state, undoEncounterChange());
    expect(state.present.actors.allIds).toEqual([
      secondActor.id,
      actor.id
    ]);
    expect(state.present.actors.byId[actor.id]?.currentZoneId).toBe(
      ZONELESS_ACTOR_ZONE_ID
    );

    state = reducer(state, undoEncounterChange());
    expect(state.present).toEqual(baseEncounter);

    state = reducer(state, redoEncounterChange());
    state = reducer(state, redoEncounterChange());
    expect(state.present).toEqual(reenteredEncounter);
  });
});
