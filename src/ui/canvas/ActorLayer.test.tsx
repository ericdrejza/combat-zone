import { render } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import type { Actor } from '@entities/actor/types';
import type { Zone } from '@entities/zone/types';
import type { SelectionState } from '@interaction/selection/types';
import { ActorLayer } from './ActorLayer';

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
          onActorMouseDown={() => undefined}
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
          onActorMouseDown={() => undefined}
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
});
