import { render, waitFor } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import type { SelectionState } from '@interaction/selection/types';
import { ActorLayer } from '@ui/canvas/actors/ActorLayer';
import { getActorRenderPlacements } from '@ui/canvas/actors/actorCanvasLayout';

function collection<TEntity extends { id: string }>(
  entities: TEntity[]
): EntityCollection<TEntity> {
  return {
    allIds: entities.map((entity) => entity.id),
    byId: Object.fromEntries(entities.map((entity) => [entity.id, entity]))
  };
}

function createZone(): Zone {
  return {
    colorBorder: '#166534',
    colorFill: '#000000',
    id: 'zone-round',
    layoutOrientation: 'LEFT_RIGHT',
    layoutStrategy: 'FLEX',
    name: 'Round Zone',
    namePosition: 'top-left',
    opacity: 1,
    polygon: [
      { x: 100, y: 100 },
      { x: 300, y: 100 },
      { x: 300, y: 300 },
      { x: 100, y: 300 }
    ],
    shape: 'circle',
    showBorder: true,
    showName: true,
    tags: []
  };
}

function createActor(zoneId: string): Actor {
  return {
    actorType: 'creature',
    currentZoneId: zoneId,
    id: 'actor-1',
    image: 'data:image/png;base64,actor',
    layoutGroup: 'hero',
    metadata: {},
    name: 'Aegis',
    shape: 'circle',
    size: 'medium',
    statusEffects: []
  };
}

describe('ActorLayer', () => {
  it('does not render a selected name underneath an actor without an image', () => {
    const zone = createZone();
    const actor = { ...createActor(zone.id), image: undefined };
    const encounter = {
      ...createEncounterState({ id: 'encounter-no-label', name: 'Test' }),
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
          placements={getActorRenderPlacements(encounter)}
          onActorMouseEnter={() => undefined}
          onActorMouseLeave={() => undefined}
          selection={{
            overlayTargets: [],
            selectedEntityType: 'actor',
            selectedIds: [actor.id]
          }}
          showFactionOutlines={false}
        />
      </svg>
    );

    expect(container.querySelector('text[dy="46"]')).toBeNull();
    expect(container.querySelector('text')?.textContent).toBe('AEGIS');
  });

  it('uses the containing zone background luminance for selected actor labels', () => {
    const zone = createZone();
    const actor = {
      ...createActor(zone.id),
      image: 'data:image/png;base64,actor'
    };
    const encounter = {
      ...createEncounterState({ id: 'encounter-test', name: 'Test' }),
      actors: collection([actor]),
      zones: collection([zone])
    };
    const selection: SelectionState = {
      overlayTargets: [],
      selectedEntityType: 'actor',
      selectedIds: [actor.id]
    };

    const { container } = render(
      <svg>
        <ActorLayer
          actorDrag={null}
          backgroundLuminanceByZoneId={{ [zone.id]: 0 }}
          canvasBackgroundLuminance={255}
          encounter={encounter}
          placements={getActorRenderPlacements(encounter)}
          onActorMouseEnter={() => undefined}
          onActorMouseLeave={() => undefined}
          selection={selection}
          showFactionOutlines={false}
        />
      </svg>
    );

    expect(container.querySelector('text[dy="46"]')).toHaveAttribute(
      'fill',
      '#ffffff'
    );
  });

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
