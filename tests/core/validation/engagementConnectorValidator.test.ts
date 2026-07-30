import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEngagement } from '@entities/engagement/engagementMutations';

vi.mock('@core/layout/engagementConnectorRouting', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@core/layout/engagementConnectorRouting')
  >();
  return {
    ...actual,
    routeEngagementConnectorGroups: () => ({
      complete: false,
      connectorsByEngagementId: {}
    })
  };
});

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

describe('engagement connector validation', () => {
  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'blocks an incomplete engagement connector network in %s mode',
    (mode) => {
      const actor = (id: string) => ({
        actorType: 'creature' as const,
        currentZoneId: 'zone',
        id,
        layoutGroup: 'neutral' as const,
        metadata: {},
        name: id,
        shape: 'circle' as const,
        size: 'small' as const,
        statusEffects: []
      });
      const currentEncounter = {
        ...createEncounterState({ id: 'connectors', name: 'Connectors' }),
        actors: collection([actor('a'), actor('b')]),
        validationState: { mode, messages: [] },
        zones: collection([{
          id: 'zone',
          colorBorder: '#123456',
          colorFill: '#ffffff',
          layoutOrientation: 'LEFT_RIGHT' as const,
          layoutStrategy: 'FLEX' as const,
          name: 'Zone',
          namePosition: 'top-left' as const,
          opacity: 1,
          polygon: [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
            { x: 300, y: 240 },
            { x: 0, y: 240 }
          ],
          shape: 'rectangle' as const,
          showBorder: true,
          showName: false,
          tags: []
        }])
      };
      const nextEncounter = createEngagement(currentEncounter, {
        id: 'melee',
        parentZoneId: 'zone',
        participantIds: ['a', 'b']
      });
      const prepared = prepareValidatedEncounterChange({
        action: createEncounterActionRecord('engagement.create', {
          parentZoneId: 'zone',
          participantIds: ['a', 'b']
        }),
        currentEncounter,
        nextEncounter
      });

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toContainEqual(
        expect.objectContaining({
          code: 'layout.engagementConnectorMissing',
          severity: 'error'
        })
      );
    }
  );
});
