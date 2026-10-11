import { describe, expect, it } from 'vitest';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor, moveActor } from '@entities/actor/actorMutations';
import { calculateActorPlacementGeometry } from '@ui/canvas/actors/actorPlacementGeometryCalculator';
import { calculateZoneLayout } from '@core/layout/encounterLayout';
import reducer, { commitEncounterChange, undoEncounterChange, redoEncounterChange } from '@store/encounterSlice';
import { collection, createState, zone } from './polygonFlexPlacementTestSupport';

for (const [split, ordinary] of [['SPLIT_FLEX', 'FLEX'], ['SPLIT_SEQUENTIAL', 'SEQUENTIAL']] as const) {
  describe(`${split} faction transitions`, () => {
    it.each(['OFF', 'ADVISORY', 'ASSISTED', 'STRICT'] as const)('restores split and full-zone layouts through exact history in %s', (mode) => {
      const residents = ['one', 'two', 'three'].map((id) =>
        buildActor({ id, currentZoneId: zone.id, layoutGroup: 'enemy' })
      );
      const incoming = buildActor({ id: 'incoming', currentZoneId: 'zoneless', layoutGroup: 'hero' });
      const currentEncounter = {
        ...createState(mode, split),
        zones: collection([{ ...zone, layoutStrategy: split, polygon: [
          { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 300 }, { x: 0, y: 300 }
        ] }]),
        actors: collection([...residents, incoming])
      };
      const ordinaryEncounter = { ...currentEncounter, zones: collection([
        { ...currentEncounter.zones.byId[zone.id], layoutStrategy: ordinary }
      ]) };
      const initialGeometry = calculateActorPlacementGeometry(currentEncounter);
      expect(initialGeometry).toEqual(calculateActorPlacementGeometry(ordinaryEncounter));
      expect(calculateZoneLayout(currentEncounter, zone.id).descriptor.strategy).toBe(ordinary);

      let history = reducer(undefined, { type: 'test/init' });
      history = reducer(history, commitEncounterChange({
        action: createEncounterActionRecord('seed'), nextEncounter: currentEncounter
      }));
      const entry = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.move', { actorId: incoming.id, destinationZoneId: zone.id }),
        currentEncounter, nextEncounter: moveActor(currentEncounter, incoming.id, zone.id)
      });
      expect(entry.blocked).toBe(false);
      expect(entry.validationResult.valid).toBe(true);
      expect(calculateZoneLayout(entry.nextEncounter, zone.id).descriptor.strategy).toBe(split);
      const mixedGeometry = calculateActorPlacementGeometry(entry.nextEncounter);
      expect(mixedGeometry).toHaveLength(4);
      expect(mixedGeometry.every((placement) => placement.sectionPolygon)).toBe(true);
      history = reducer(history, commitEncounterChange({ action: entry.action, nextEncounter: entry.nextEncounter }));

      const departure = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('actor.move', { actorId: incoming.id, destinationZoneId: 'zoneless' }),
        currentEncounter: entry.nextEncounter,
        nextEncounter: moveActor(entry.nextEncounter, incoming.id, 'zoneless')
      });
      expect(departure.blocked).toBe(false);
      expect(calculateActorPlacementGeometry(departure.nextEncounter)).toEqual(initialGeometry);
      expect(departure.nextEncounter.zones.byId[zone.id].layoutStrategy).toBe(split);
      history = reducer(history, commitEncounterChange({ action: departure.action, nextEncounter: departure.nextEncounter }));
      history = reducer(history, undoEncounterChange());
      expect(history.present).toEqual(entry.nextEncounter);
      expect(calculateActorPlacementGeometry(history.present)).toEqual(mixedGeometry);
      history = reducer(history, undoEncounterChange());
      expect(history.present).toEqual(currentEncounter);
      expect(calculateActorPlacementGeometry(history.present)).toEqual(initialGeometry);
      history = reducer(history, redoEncounterChange());
      expect(history.present).toEqual(entry.nextEncounter);
      history = reducer(history, redoEncounterChange());
      expect(history.present).toEqual(departure.nextEncounter);
    });
  });
}
