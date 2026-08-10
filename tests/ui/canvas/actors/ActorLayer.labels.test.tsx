import { render } from '@testing-library/react';

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
});
