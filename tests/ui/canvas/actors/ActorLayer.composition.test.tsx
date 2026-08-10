import { render } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { SelectionState } from '@interaction/selection/types';
import { ActorLayer } from '@ui/canvas/actors/ActorLayer';
import {
  collection,
  createActor,
  createZone
} from './actorLayerTestFixtures';

describe('ActorLayer', () => {
  it('uses an explicit Motion path when actor composition changes its target', () => {
    const zone = createZone();
    const actor = createActor(zone.id);
    const encounter = {
      ...createEncounterState({ id: 'encounter-reflow-animation', name: 'Test' }),
      actors: collection([actor]),
      zones: collection([zone])
    };
    const commonProps = {
      actorDrag: null,
      backgroundLuminanceByZoneId: { [zone.id]: 0 },
      canvasBackgroundLuminance: 255,
      encounter,
      onActorMouseEnter: () => undefined,
      onActorMouseLeave: () => undefined,
      selection: {
        overlayTargets: [],
        selectedEntityType: null,
        selectedIds: []
      } satisfies SelectionState,
      showFactionOutlines: false
    };
    const { container, rerender } = render(
      <svg>
        <ActorLayer
          {...commonProps}
          placements={[{
            actor,
            point: { x: 150, y: 160 },
            radius: 30
          }]}
        />
      </svg>
    );
    const actorNode = container.querySelector('[data-entity-id="actor-1"]');

    rerender(
      <svg>
        <ActorLayer
          {...commonProps}
          placements={[{
            actor,
            point: { x: 230, y: 210 },
            radius: 30
          }]}
        />
      </svg>
    );

    expect(container.querySelector('[data-entity-id="actor-1"]')).toBe(actorNode);
    expect(actorNode).toHaveAttribute(
      'data-motion-path',
      JSON.stringify({
        x: [150, 230],
        y: [160, 210]
      })
    );
    expect(actorNode).toHaveStyle({
      transform: 'translateX(230px) translateY(210px)'
    });
  });

  it('keeps neighbor reflow automatic while another actor drag is still active', () => {
    const zone = createZone();
    const draggedActor = createActor(zone.id);
    const neighbor = {
      ...createActor(zone.id),
      id: 'actor-neighbor',
      name: 'Neighbor'
    };
    const encounter = {
      ...createEncounterState({ id: 'encounter-drag-reflow', name: 'Test' }),
      actors: collection([draggedActor, neighbor]),
      zones: collection([zone])
    };
    const actorDrag = {
      actorId: draggedActor.id,
      actorIds: [draggedActor.id],
      current: { x: 420, y: 200 },
      hasMoved: true,
      phase: 'dragging' as const,
      start: { x: 150, y: 160 }
    };
    const commonProps = {
      actorDrag,
      backgroundLuminanceByZoneId: { [zone.id]: 0 },
      canvasBackgroundLuminance: 255,
      encounter,
      onActorMouseEnter: () => undefined,
      onActorMouseLeave: () => undefined,
      selection: {
        overlayTargets: [],
        selectedEntityType: null,
        selectedIds: []
      } satisfies SelectionState,
      showFactionOutlines: false
    };
    const { container, rerender } = render(
      <svg>
        <ActorLayer
          {...commonProps}
          placements={[
            { actor: draggedActor, point: { x: 150, y: 160 }, radius: 30 },
            { actor: neighbor, point: { x: 230, y: 160 }, radius: 30 }
          ]}
        />
      </svg>
    );
    const neighborNode = container.querySelector(
      '[data-entity-id="actor-neighbor"]'
    );

    rerender(
      <svg>
        <ActorLayer
          {...commonProps}
          placements={[
            { actor: draggedActor, point: { x: 500, y: 160 }, radius: 30 },
            { actor: neighbor, point: { x: 190, y: 210 }, radius: 30 }
          ]}
        />
      </svg>
    );

    expect(neighborNode).toHaveAttribute(
      'data-motion-path',
      JSON.stringify({
        x: [230, 190],
        y: [160, 210]
      })
    );
  });
});
