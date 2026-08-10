import { render, waitFor } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { SelectionState } from '@interaction/selection/types';
import { ActorLayer } from '@ui/canvas/actors/ActorLayer';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';
import {
  collection,
  createActor,
  createZone
} from './actorLayerTestFixtures';

describe('ActorLayer', () => {
  it('translates actors with a moving zone without changing their layout', () => {
    const zone = createZone();
    const actor = createActor(zone.id);
    const encounter = {
      ...createEncounterState({ id: 'encounter-zone-translation', name: 'Test' }),
      actors: collection([actor]),
      zones: collection([zone])
    };
    const placement = getActorRenderPlacements(encounter)[0];

    const { container } = render(
      <svg>
        <ActorLayer
          actorDrag={null}
          backgroundLuminanceByZoneId={{ [zone.id]: 0 }}
          canvasBackgroundLuminance={255}
          encounter={encounter}
          placements={[placement]}
          zoneActorTranslation={{
            offset: { x: 40, y: -25 },
            zoneId: zone.id
          }}
          onActorMouseEnter={() => undefined}
          onActorMouseLeave={() => undefined}
          selection={{
            overlayTargets: [],
            selectedEntityType: null,
            selectedIds: []
          }}
          showFactionOutlines={false}
        />
      </svg>
    );

    expect(container.querySelector('[data-entity-id="actor-1"]')).toHaveStyle({
      transform: `translateX(${placement.point.x + 40}px) translateY(${placement.point.y - 25}px)`
    });
  });

  it('starts a packed placement motion path at its incoming drop point', () => {
    const zone = createZone();
    const actor = createActor(zone.id);
    const encounter = {
      ...createEncounterState({ id: 'encounter-placement-animation', name: 'Test' }),
      actors: collection([actor]),
      zones: collection([zone])
    };
    const { container } = render(
      <svg>
        <ActorLayer
          actorDrag={null}
          backgroundLuminanceByZoneId={{ [zone.id]: 0 }}
          canvasBackgroundLuminance={255}
          encounter={encounter}
          placements={[{
            actor,
            incomingPoint: { x: 140, y: 160 },
            point: { x: 220, y: 240 },
            radius: 30
          }]}
          onActorMouseEnter={() => undefined}
          onActorMouseLeave={() => undefined}
          selection={{
            overlayTargets: [],
            selectedEntityType: null,
            selectedIds: []
          }}
          showFactionOutlines={false}
        />
      </svg>
    );

    const actorNode = container.querySelector('[data-entity-id="actor-1"]');

    expect(actorNode).toHaveAttribute(
      'data-motion-path',
      JSON.stringify({
        x: [140, 220],
        y: [160, 240]
      })
    );
  });

  it('holds a cross-zone drop until its authoritative target is ready', async () => {
    const sourceZone = createZone();
    const destinationZone = { ...createZone(), id: 'zone-destination' };
    const sourceActor = createActor(sourceZone.id);
    const destinationActor = {
      ...sourceActor,
      currentZoneId: destinationZone.id
    };
    const encounter = {
      ...createEncounterState({ id: 'encounter-worker-handoff', name: 'Test' }),
      actors: collection([destinationActor]),
      zones: collection([sourceZone, destinationZone])
    };
    const onIncomingPointCommitted = vi.fn();
    const dragging = {
      actorId: sourceActor.id,
      actorIds: [sourceActor.id],
      current: { x: 540, y: 220 },
      hasMoved: true,
      originPointsByActorId: { [sourceActor.id]: { x: 180, y: 180 } },
      phase: 'dragging' as const,
      start: { x: 180, y: 180 }
    };
    const returning = {
      ...dragging,
      phase: 'returning' as const
    };
    const commonProps = {
      backgroundLuminanceByZoneId: {
        [sourceZone.id]: 0,
        [destinationZone.id]: 0
      },
      canvasBackgroundLuminance: 255,
      encounter,
      onActorMouseEnter: () => undefined,
      onActorMouseLeave: () => undefined,
      onIncomingPointCommitted,
      selection: {
        overlayTargets: [],
        selectedEntityType: null,
        selectedIds: []
      } satisfies SelectionState,
      showFactionOutlines: false
    };
    const dropPoint = { x: 540, y: 220 };
    const settledPoint = { x: 590, y: 180 };
    const { container, rerender } = render(
      <svg>
        <ActorLayer
          {...commonProps}
          actorDrag={dragging}
          placements={[{
            actor: sourceActor,
            point: { x: 180, y: 180 },
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
          actorDrag={returning}
          placements={[{
            actor: destinationActor,
            point: dropPoint,
            radius: 30
          }]}
        />
      </svg>
    );

    expect(container.querySelector('[data-entity-id="actor-1"]')).toBe(actorNode);
    expect(actorNode).toHaveStyle({
      transform: `translateX(${dropPoint.x}px) translateY(${dropPoint.y}px)`
    });
    expect(onIncomingPointCommitted).not.toHaveBeenCalled();

    rerender(
      <svg>
        <ActorLayer
          {...commonProps}
          actorDrag={returning}
          placements={[{
            actor: destinationActor,
            incomingPoint: dropPoint,
            point: settledPoint,
            radius: 30
          }]}
        />
      </svg>
    );

    await waitFor(() =>
      expect(actorNode).toHaveAttribute(
        'data-motion-path',
        JSON.stringify({
          x: [dropPoint.x, settledPoint.x],
          y: [dropPoint.y, settledPoint.y]
        })
      )
    );
    expect(container.querySelector('[data-entity-id="actor-1"]')).toBe(actorNode);
    expect(onIncomingPointCommitted).toHaveBeenCalledWith(sourceActor.id);
  });

  it('returns the single canvas actor without reapplying its drag offset', () => {
    const zone = createZone();
    const actor = createActor(zone.id);
    const encounter = {
      ...createEncounterState({ id: 'encounter-drag-return', name: 'Test' }),
      actors: collection([actor]),
      zones: collection([zone])
    };
    const onActorReturnComplete = vi.fn();
    const commonProps = {
      backgroundLuminanceByZoneId: { [zone.id]: 0 },
      canvasBackgroundLuminance: 255,
      encounter,
      onActorMouseEnter: () => undefined,
      onActorMouseLeave: () => undefined,
      onActorReturnComplete,
      placements: [{ actor, point: { x: 150, y: 160 }, radius: 30 }],
      selection: {
        overlayTargets: [],
        selectedEntityType: null,
        selectedIds: []
      } satisfies SelectionState,
      showFactionOutlines: false
    };
    const dragging = {
      actorId: actor.id,
      actorIds: [actor.id],
      current: { x: 250, y: 210 },
      hasMoved: true,
      originPointsByActorId: { [actor.id]: { x: 150, y: 160 } },
      phase: 'dragging' as const,
      start: { x: 150, y: 160 }
    };
    const { container, rerender } = render(
      <svg>
        <ActorLayer {...commonProps} actorDrag={dragging} />
      </svg>
    );

    const returning = {
      ...dragging,
      phase: 'returning' as const,
      returnPointsByActorId: dragging.originPointsByActorId
    };

    rerender(
      <svg>
        <ActorLayer {...commonProps} actorDrag={returning} />
      </svg>
    );

    expect(
      container.querySelector('[data-entity-id="actor-1"]')
    ).not.toHaveAttribute('data-motion-path');
    expect(
      container.querySelector('[data-entity-id="actor-1"]')
    ).toHaveStyle({
      transform: 'translateX(150px) translateY(160px)'
    });
    expect(onActorReturnComplete).toHaveBeenCalledWith(actor.id);

    rerender(
      <svg>
        <ActorLayer
          {...commonProps}
          actorDrag={{
            ...returning,
            current: { ...returning.current }
          }}
        />
      </svg>
    );

    expect(onActorReturnComplete).toHaveBeenCalledTimes(1);
  });
});
