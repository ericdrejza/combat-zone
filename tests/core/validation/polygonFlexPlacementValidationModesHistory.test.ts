import { describe, expect, it } from 'vitest';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { buildActor } from '@entities/actor/actorMutations';
import { createEngagement, joinEngagement } from '@entities/engagement/engagementMutations';
import reducer, { commitEncounterChange, redoEncounterChange, undoEncounterChange } from '@store/encounterSlice';
import { collection, createState, zone } from './polygonFlexPlacementTestSupport';

describe('polygon validation history', () => {
  it.each(['ADVISORY', 'STRICT'] as const)(
    'automatically enlarges an enabled zone for a same-zone engagement join in %s mode with exact undo/redo',
    (mode) => {
      const autoResizeZone = {
        ...zone,
        autoResize: true,
        polygon: [
          { x: 0, y: 0 },
          { x: 190, y: 0 },
          { x: 190, y: 140 },
          { x: 0, y: 140 }
        ]
      };
      const participants = ['participant-one', 'participant-two'].map((id) =>
        buildActor({ currentZoneId: autoResizeZone.id, id })
      );
      const joiningActor = buildActor({
        currentZoneId: autoResizeZone.id,
        id: 'same-zone-joining-actor'
      });
      const currentEncounter = createEngagement(
        {
          ...createState(mode),
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
        prepared.nextEncounter.engagements.byId['target-engagement']
          ?.participantIds
      ).toContain(joiningActor.id);

      let history = reducer(undefined, { type: 'test/init' });
      history = reducer(
        history,
        commitEncounterChange({
          action: createEncounterActionRecord('seed'),
          nextEncounter: currentEncounter
        })
      );
      history = reducer(
        history,
        commitEncounterChange({
          action: prepared.action,
          nextEncounter: prepared.nextEncounter
        })
      );

      expect(reducer(history, undoEncounterChange()).present).toEqual(
        currentEncounter
      );
      expect(
        reducer(reducer(history, undoEncounterChange()), redoEncounterChange())
          .present
      ).toEqual(prepared.nextEncounter);
    }
  );

});
