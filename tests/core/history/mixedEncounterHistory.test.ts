import { createEncounterState } from '@core/encounter/createEncounterState';
import { addActorsToInitiative, reorderInitiativeActor } from '@core/encounter/initiativeMutations';
import type { EncounterState } from '@core/encounter/types';
import type { JsonObject } from '@core/history/types';
import { createEncounterHistoryState } from '@core/history/types';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createActor, moveActor, deleteActor } from '@entities/actor/actorMutations';
import { createZone, deleteZone, updateZonePolygon } from '@entities/zone/zoneMutations';
import { createEngagement, mergeEngagements, leaveEngagements } from '@entities/engagement/engagementMutations';
import { createOrReplaceEdge, DEFAULT_EDGE_PRESET, deleteEdges } from '@entities/edge/edgeMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';

it('restores every snapshot through a rapid mixed sequence with destructive cascades', () => {
  const initial = createEncounterState({ id: 'mixed-history', name: 'Mixed history' });
  let history = createEncounterHistoryState(initial);
  const snapshots = [initial];
  const commit = (type: string, mutate: (state: EncounterState) => EncounterState, payload: JsonObject = {}) => {
    const prepared = prepareValidatedEncounterChange({ currentEncounter: history.present, nextEncounter: mutate(history.present), action: createEncounterActionRecord(type, payload) });
    expect(prepared.blocked).toBe(false);
    history = reducer(history, commitEncounterChange({ action: prepared.action, nextEncounter: prepared.nextEncounter }));
    snapshots.push(history.present);
  };
  const polygon = (x: number) => [{ x, y: 10 }, { x: x + 300, y: 10 }, { x: x + 300, y: 400 }, { x, y: 400 }];
  commit('zone.create', s => createZone(s, { id: 'one', polygon: polygon(10), shape: 'rectangle' }), { zoneId: 'one', polygon: polygon(10) });
  commit('zone.create', s => createZone(s, { id: 'two', polygon: polygon(500), shape: 'rectangle' }), { zoneId: 'two', polygon: polygon(500) });
  for (const id of ['a', 'b', 'c', 'd']) commit('actor.create', s => createActor(s, { id, name: id, currentZoneId: 'one', size: 'small' }));
  commit('engagement.create', s => createEngagement(s, { id: 'source', parentZoneId: 'one', participantIds: ['a', 'b'] }));
  commit('engagement.create', s => createEngagement(s, { id: 'target', parentZoneId: 'one', participantIds: ['c', 'd'] }));
  commit('engagement.merge', s => mergeEngagements(s, 'source', 'target'));
  commit('engagement.leave', s => leaveEngagements(s, ['a', 'b']));
  commit('actor.move', s => moveActor(s, 'a', 'two'));
  commit('edge.create', s => createOrReplaceEdge(s, { ...DEFAULT_EDGE_PRESET, id: 'edge', fromZoneId: 'one', toZoneId: 'two' }).nextEncounter);
  commit('initiative.addActors', s => addActorsToInitiative(s, ['a', 'b', 'c', 'd']));
  commit('initiative.reorder', s => reorderInitiativeActor(s, 'd', ['d', 'a', 'b', 'c']));
  commit('zone.reshape', s => updateZonePolygon(s, 'two', polygon(550)), { zoneId: 'two', polygon: polygon(550) });
  commit('edge.delete', s => deleteEdges(s, ['edge']));
  commit('edge.create', s => createOrReplaceEdge(s, { ...DEFAULT_EDGE_PRESET, id: 'edge-2', fromZoneId: 'one', toZoneId: 'two' }).nextEncounter);
  commit('actor.delete', s => deleteActor(s, 'c'));
  commit('zone.delete', s => deleteZone(s, 'one'));
  expect(history.past).toHaveLength(snapshots.length - 1);
  for (let i = snapshots.length - 2; i >= 0; i--) {
    history = reducer(history, undoEncounterChange());
    expect(history.present).toEqual(snapshots[i]);
  }
  expect(history.present).toEqual(initial);
  for (const snapshot of snapshots.slice(1)) {
    history = reducer(history, redoEncounterChange());
    expect(history.present).toEqual(snapshot);
  }
});
