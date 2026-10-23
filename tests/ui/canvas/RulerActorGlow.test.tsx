import { render } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { RulerActorGlow } from '@ui/canvas/ruler/RulerActorGlow';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import type { Actor } from '@entities/actor/types';

it('tracks the live drag position, including returning actors, without changing accepted positions', () => {
  const encounter = createEncounterState({ id: 'live', name: 'Live' }); encounter.movementRules.snapToGrid = false;
  const actor: Actor = { id: 'a', name: 'Actor', actorType: 'creature', layoutGroup: 'enemy', size: 'medium', shape: 'circle', currentZoneId: 'zoneless', statusEffects: [], metadata: {} };
  const point = { x: 400, y: 128 }, placements = [{ actor, point, radius: 30 }];
  const props = { encounter, points: [{ x: 128, y: 128 }, { x: 256, y: 128 }], options: { shape: 'circle' as const }, policy: 'one' as const, coverage: 'center' as const, placements, projectTokens: false, intensity: 0.5 };
  const { container, rerender } = render(<svg><RulerActorGlow {...props} /></svg>);
  const highlight = () => container.querySelector('[data-ruler-highlight-actor="a"]');
  expect(highlight()).toBeNull();
  const drag: ActorDragState = { actorId: 'a', actorIds: ['a'], phase: 'dragging', hasMoved: true, start: point, current: { x: 224, y: 128 } };
  rerender(<svg><RulerActorGlow {...props} drag={drag} /></svg>); expect(highlight()).toBeInTheDocument();
  rerender(<svg><RulerActorGlow {...props} drag={{ ...drag, current: { x: 400, y: 128 } }} /></svg>); expect(highlight()).toBeNull();
  rerender(<svg><RulerActorGlow {...props} drag={{ ...drag, phase: 'returning', returnPointsByActorId: { a: { x: 224, y: 128 } } }} /></svg>); expect(highlight()).toBeInTheDocument();
  expect(placements[0].point).toEqual(point); expect(encounter.rulers.allIds).toEqual([]);
});
