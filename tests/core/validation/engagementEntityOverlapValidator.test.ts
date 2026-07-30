import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EntityCollection } from '@core/state/entityCollection';
import { prepareValidatedEncounterChange } from '@core/validation/validatedEncounterChange';
import { createEngagement } from '@entities/engagement/engagementMutations';

const overlapAudit = vi.hoisted(() => ({ separate: true }));
vi.mock('@core/validation/engagementEntityOverlap', () => ({
  engagementEntitiesAreSeparate: () => overlapAudit.separate
}));

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function prepare(mode: 'OFF' | 'ADVISORY' | 'STRICT') {
  const actor = (id: string) => ({
    actorType: 'creature' as const,
    currentZoneId: 'zone',
    id,
    layoutGroup: 'neutral' as const,
    metadata: {},
    name: id,
    shape: 'rectangle' as const,
    size: 'small' as const,
    statusEffects: []
  });
  const currentEncounter = {
    ...createEncounterState({ id: 'overlap-audit', name: 'Overlap audit' }),
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

  return prepareValidatedEncounterChange({
    action: createEncounterActionRecord('engagement.create', {
      parentZoneId: 'zone',
      participantIds: ['a', 'b']
    }),
    currentEncounter,
    nextEncounter
  });
}

describe('engagement entity overlap validator', () => {
  it.each(['OFF', 'ADVISORY', 'STRICT'] as const)(
    'hard-blocks a negative overlap audit in %s mode',
    (mode) => {
      overlapAudit.separate = false;
      const prepared = prepare(mode);

      expect(prepared.blocked).toBe(true);
      expect(prepared.validationResult.messages).toContainEqual(
        expect.objectContaining({
          code: 'layout.engagementEntityOverlap',
          severity: 'error'
        })
      );
    }
  );

  it('accepts a positive overlap audit', () => {
    overlapAudit.separate = true;
    const prepared = prepare('STRICT');

    expect(prepared.blocked).toBe(false);
    expect(prepared.validationResult.messages).not.toContainEqual(
      expect.objectContaining({ code: 'layout.engagementEntityOverlap' })
    );
  });
});
