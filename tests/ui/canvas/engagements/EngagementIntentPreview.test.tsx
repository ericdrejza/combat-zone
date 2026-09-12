import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { EngagementIntentPreview } from '@ui/canvas/engagements/EngagementIntentPreview';

describe('EngagementIntentPreview', () => {
  it('shows the engagement icon for a matured existing-engagement hover', () => {
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
    const encounter = {
      ...createEncounterState({ id: 'intent', name: 'Intent' }),
      actors: {
        allIds: ['a', 'b', 'c'],
        byId: { a: actor('a'), b: actor('b'), c: actor('c') }
      },
      engagements: {
        allIds: ['melee'],
        byId: {
          melee: {
            id: 'melee',
            layoutOrientation: 'LEFT_RIGHT' as const,
            layoutStrategy: 'FLEX' as const,
            parentZoneId: 'zone',
            participantIds: ['b', 'c']
          }
        }
      },
      zones: {
        allIds: ['zone'],
        byId: {
          zone: {
            colorBorder: '#123456',
            colorEngagement: '#fed7aa',
            colorFill: '#ffffff',
            id: 'zone',
            layoutOrientation: 'LEFT_RIGHT' as const,
            layoutStrategy: 'FLEX' as const,
            matchEngagementColorToBorder: false,
            name: 'Zone',
            namePosition: 'top-left' as const,
            opacity: 1,
            polygon: [
              { x: 0, y: 0 },
              { x: 300, y: 0 },
              { x: 300, y: 300 },
              { x: 0, y: 300 }
            ],
            shape: 'rectangle' as const,
            showBorder: true,
            showName: false,
            tags: []
          }
        }
      }
    };
    const actorDrag: ActorDragState = {
      actorId: 'a',
      actorIds: ['a'],
      current: { x: 50, y: 50 },
      engagementIntentEngagementId: 'melee',
      hasMoved: true,
      phase: 'dragging',
      start: { x: 0, y: 0 }
    };

    const { container } = render(
      <svg>
        <EngagementIntentPreview
          actorDrag={actorDrag}
          encounter={encounter}
          placements={[
            {
              actor: encounter.actors.byId.a,
              point: { x: 40, y: 40 },
              radius: 15
            }
          ]}
        />
      </svg>
    );

    expect(
      screen.getByLabelText('Engagement drop intent')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Crossed swords')).toHaveAttribute(
      'href',
      expect.stringMatching(/^data:image\/svg\+xml/)
    );
    expect(container.querySelector('mask')).toBeNull();
    expect(container.querySelector('circle')).toHaveAttribute(
      'stroke',
      '#fed7aa'
    );
  });
});
