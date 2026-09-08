import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Engagement } from '@entities/engagement/types';
import type { Zone } from '@entities/zone/types';
import { EngagementDragPreview } from '@ui/canvas/engagements/EngagementDragPreview';
import { EngagementLayer } from '@ui/canvas/engagements/EngagementLayer';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map(({ id }) => id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

const zone: Zone = {
  colorBorder: '#123456',
  colorFill: '#ffffff',
  id: 'zone',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  name: 'Zone',
  namePosition: 'top-left',
  opacity: 1,
  polygon: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 300 },
    { x: 0, y: 300 }
  ],
  shape: 'rectangle',
  showBorder: true,
  showName: false,
  tags: []
};

const actor = (id: string): Actor => ({
  actorType: 'creature',
  currentZoneId: zone.id,
  id,
  layoutGroup: 'hero',
  metadata: {},
  name: id,
  shape: 'circle',
  size: 'small',
  statusEffects: []
});

const actors = ['a', 'b', 'c'].map(actor);
const engagement: Engagement = {
  id: 'melee',
  layoutOrientation: 'LEFT_RIGHT',
  layoutStrategy: 'FLEX',
  parentZoneId: zone.id,
  participantIds: actors.map(({ id }) => id)
};
const encounter = {
  ...createEncounterState({ id: 'actor-drag', name: 'Actor drag' }),
  actors: collection(actors),
  engagements: collection([engagement]),
  zones: collection([zone])
};
const token = { x: 50, y: 100 };
const placements = actors.map((placedActor, index) => ({
  actor: placedActor,
  engagementTokenPoint: token,
  point: { x: 100 + index * 50, y: 100 },
  radius: 15
}));
const sharedLayerProps = {
  activeToolId: 'select' as const,
  backgroundLuminanceByZoneId: { zone: 255 },
  encounter,
  engagementDrag: null,
  onEngagementDrag: () => undefined,
  onEngagementDragEnd: () => undefined,
  onEngagementDragReturnComplete: () => undefined,
  onEngagementDragStart: () => undefined,
  onEngagementSelect: () => undefined,
  placements,
  selection: {
    selectedEntityType: null,
    selectedIds: [],
    overlayTargets: []
  }
};

describe('Engagement actor drag rendering', () => {
  it('retracts every connector branch touched by a dragged proper subset', () => {
    const { container } = render(
      <svg>
        <EngagementLayer
          {...sharedLayerProps}
          actorDrag={{
            actorId: 'a',
            actorIds: ['a', 'b'],
            current: { x: 180, y: 100 },
            hasMoved: true,
            phase: 'dragging',
            start: { x: 100, y: 100 }
          }}
        />
      </svg>
    );

    // The routed chain is token→a→b→c, so moving a and b retracts all three
    // settled branches instead of leaving the b→c branch behind.
    expect(container.querySelectorAll('line[data-engagement-connector]')).toHaveLength(0);
  });

  it('previews a retracting tether for every dragged subset participant', () => {
    const { container, rerender } = render(
      <svg>
        <EngagementDragPreview
          actorDrag={{
            actorId: 'a',
            actorIds: ['a', 'b'],
            current: { x: 120, y: 100 },
            hasMoved: true,
            phase: 'dragging',
            start: { x: 100, y: 100 }
          }}
          encounter={encounter}
          placements={placements}
        />
      </svg>
    );

    expect(
      container.querySelectorAll('[data-engagement-drag-preview]')
    ).toHaveLength(2);

    rerender(
      <svg>
        <EngagementDragPreview
          actorDrag={{
            actorId: 'a',
            actorIds: ['a', 'b'],
            current: { x: 180, y: 100 },
            hasMoved: true,
            phase: 'dragging',
            start: { x: 100, y: 100 }
          }}
          encounter={encounter}
          placements={placements}
        />
      </svg>
    );

    Array.from(container.querySelectorAll('line[data-engagement-connector]')).forEach((line) => {
      expect(line).toHaveAttribute('x1', String(token.x));
      expect(line).toHaveAttribute('x2', String(token.x));
      expect(line).toHaveAttribute('y1', String(token.y));
      expect(line).toHaveAttribute('y2', String(token.y));
    });
  });

  it('moves a complete engagement token and connector network by the actor drag vector', () => {
    const { container } = render(
      <svg>
        <EngagementLayer
          {...sharedLayerProps}
          actorDrag={{
            actorId: 'a',
            actorIds: ['a', 'b', 'c'],
            current: { x: 140, y: 80 },
            hasMoved: true,
            phase: 'dragging',
            start: { x: 100, y: 100 }
          }}
        />
      </svg>
    );
    const lines = Array.from(container.querySelectorAll('line[data-engagement-connector]'));

    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveAttribute('x1', '90');
    expect(lines[0]).toHaveAttribute('y1', '80');
    expect(lines[0]).toHaveAttribute('x2', '140');
    expect(lines[0]).toHaveAttribute('y2', '80');
  });

  it('does not draw duplicate subset tethers when the complete group moves', () => {
    const { container } = render(
      <svg>
        <EngagementDragPreview
          actorDrag={{
            actorId: 'a',
            actorIds: ['a', 'b', 'c'],
            current: { x: 140, y: 80 },
            hasMoved: true,
            phase: 'dragging',
            start: { x: 100, y: 100 }
          }}
          encounter={encounter}
          placements={placements}
        />
      </svg>
    );

    expect(container.querySelector('line[data-engagement-connector]')).toBeNull();
  });
});
