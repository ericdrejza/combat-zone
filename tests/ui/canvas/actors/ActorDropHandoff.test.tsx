import { Fragment, StrictMode } from 'react';
import { render } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { ActorLayer } from '@ui/canvas/actors/ActorLayer';

it.each([false, true])('holds the pointer endpoint through validation and snap settling (StrictMode: %s)', strict => {
  const Boundary = strict ? StrictMode : Fragment;
  const encounter = createActor(createEncounterState({ id: 'handoff', name: 'Handoff' }), { id: 'a', name: 'Actor', currentZoneId: 'zoneless' });
  encounter.movementRules.zoneLocked = false;
  const actor = encounter.actors.byId.a, origin = { x: 160, y: 160 }, dropped = { x: 250, y: 210 }, snapped = { x: 256, y: 224 };
  const props = {
    encounter, backgroundLuminanceByZoneId: {}, canvasBackgroundLuminance: 1,
    onActorMouseEnter: () => undefined, onActorMouseLeave: () => undefined, showFactionOutlines: false,
    selection: { selectedEntityType: null, selectedIds: [], overlayTargets: [] }
  };
  const dragging: ActorDragState = { actorId: 'a', actorIds: ['a'], start: origin, current: dropped,
    originPointsByActorId: { a: origin }, phase: 'dragging', hasMoved: true };
  const layer = (drag: ActorDragState | null, point = origin) => <Boundary><svg><ActorLayer {...props} actorDrag={drag} placements={[{ actor, point, radius: 30 }]} /></svg></Boundary>;
  const view = render(layer(null));
  view.rerender(layer(dragging));
  view.rerender(layer({ ...dragging, phase: 'validating' }));
  const node = view.container.querySelector('[data-entity-id="a"]')!;
  expect(node).not.toHaveAttribute('data-motion-path');
  view.rerender(layer({ ...dragging, phase: 'returning' }, snapped));
  const track = JSON.parse(node.getAttribute('data-motion-path') ?? '{}');
  expect(track).toEqual({ x: [dropped.x, snapped.x], y: [dropped.y, snapped.y] });
});
