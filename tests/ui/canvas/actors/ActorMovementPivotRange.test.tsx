import { render } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { ActorMovementOverlay } from '@ui/canvas/actors/ActorMovementOverlay';
import { ActorMovementRange } from '@ui/canvas/actors/ActorMovementRange';
import type { ActorDragState } from '@ui/canvas/canvasInteractionTypes';

vi.mock('@ui/canvas/actors/ActorMovementRange', () => ({ ActorMovementRange: vi.fn(() => null) }));
vi.mock('@ui/combat_preferences/useMovementPreferences', () => ({
  useMovementPreferences: () => ({ preferences: { diagonalCost: 'alternating', trackMovement: true } })
}));
vi.mock('@ui/canvas_preferences/useCanvasPreferences', () => ({
  useCanvasPreferences: () => ({ preferences: { showActorMovementDistance: true, rulerOpacity: 1 } })
}));

function fixture(snapped = false) {
  let encounter = createEncounterState({ id: 'range', name: 'Range' });
  encounter = createActor(encounter, { id: 'a', name: 'Alpha', currentZoneId: 'zoneless' });
  encounter.movementRules.zoneLocked = false;
  encounter.movementRules.snapToGrid = snapped;
  encounter.actors.byId.a.spatialPosition = { x: 160, y: 160 };
  encounter.actors.byId.a.movementLimit = 30;
  const drag: ActorDragState = { actorId: 'a', actorIds: ['a'], start: { x: 160, y: 160 },
    current: { x: 352, y: 288 }, hasMoved: true, phase: 'dragging' };
  return { encounter, drag };
}
const range = () => vi.mocked(ActorMovementRange).mock.calls.at(-1)![0];
beforeEach(() => vi.mocked(ActorMovementRange).mockClear());

it('recenters and reduces the envelope at each pivot, and restores it when pivots are removed', () => {
  const { encounter, drag } = fixture();
  const { rerender } = render(<svg><ActorMovementOverlay encounter={encounter} drag={drag} /></svg>);
  expect(range()).toMatchObject({ origin: drag.start, available: 30, priorDiagonals: 0 });
  const first = { x: 288, y: 160 }, second = { x: 288, y: 288 };
  const update = (waypoints: ActorDragState['waypoints'], current = drag.current) => {
    rerender(<svg><ActorMovementOverlay encounter={encounter} drag={{ ...drag, waypoints, current }} /></svg>);
  };
  update([first]);
  expect(range()).toMatchObject({ origin: first, available: 20 });
  update([first], { x: 416, y: 416 });
  expect(range()).toMatchObject({ origin: first, available: 20 });
  update([first, second]);
  expect(range()).toMatchObject({ origin: second, available: 10 });
  update([first]);
  expect(range()).toMatchObject({ origin: first, available: 20 });
  update([]);
  expect(range()).toMatchObject({ origin: drag.start, available: 30 });
  expect(encounter.actors.byId.a.spatialPosition).toEqual(drag.start);
});

it('subtracts tracked movement and carries alternating-diagonal parity through snapped pivots', () => {
  const { encounter, drag } = fixture(true);
  encounter.initiativeTracker.currentActorId = 'a';
  encounter.initiativeTracker.currentRound = 1;
  encounter.initiativeTracker.movement = { a: { distance: 5, diagonals: 1 } };
  const pivot = { x: 224, y: 224 };
  render(<svg><ActorMovementOverlay encounter={encounter} drag={{ ...drag, waypoints: [pivot] }} /></svg>);
  expect(range()).toMatchObject({ origin: pivot, available: 15, priorDiagonals: 2 });
});

it('keeps each group member’s own origin, movement limit, and remaining budget', () => {
  let { encounter, drag } = fixture();
  encounter = createActor(encounter, { id: 'b', name: 'Bravo', currentZoneId: 'zoneless' });
  encounter.actors.byId.b.spatialPosition = { x: 160, y: 352 };
  encounter.actors.byId.b.movementLimit = 5;
  const offset = { x: 288, y: 160 };
  render(<svg><ActorMovementOverlay encounter={encounter} drag={{ ...drag, actorIds: ['a', 'b'], waypoints: [offset] }} /></svg>);
  const calls = vi.mocked(ActorMovementRange).mock.calls.map(([props]) => props);
  expect(calls.find(props => props.actor.id === 'a')).toMatchObject({ origin: offset, available: 20 });
  expect(calls.find(props => props.actor.id === 'b')).toMatchObject({ origin: { x: 288, y: 352 }, available: 0 });
});
