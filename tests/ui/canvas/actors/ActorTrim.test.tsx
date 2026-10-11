import { render } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { createActor } from '@entities/actor/actorMutations';
import { actorAnchorCells, canvasAnchors } from '@core/movement/gridTopology';
import { ActorTrim } from '@ui/canvas/actors/ActorTrim';

it.each(['hex-flat', 'hex-pointy'] as const)('clips Large/xLarge %s artwork to its cell union while retaining the full hit target', type => {
  for (const size of ['large', 'xLarge'] as const) {
    const state = createActor(createEncounterState({ id: type, name: type }), { id: 'a', currentZoneId: 'zoneless', size });
    state.grid.type = type;
    Object.assign(state.movementRules, { snapToGrid: true, trimTokens: true });
    const point = canvasAnchors(state, size).find(p => p.x > 180 && p.y > 180)!;
    const actor = state.actors.byId.a;
    const view = render(<svg><ActorTrim encounter={state} actor={actor} point={point}>{clipId => <g data-testid="artwork" clipPath={clipId ? `url(#${clipId})` : undefined}><circle r="1" /></g>}</ActorTrim></svg>);
    const path = view.container.querySelector('clipPath path')!.getAttribute('d')!;
    expect(path.match(/M/g)).toHaveLength(size === 'large' ? 3 : 7);
    expect(path.match(/M/g)).toHaveLength(actorAnchorCells(state, point, size).length);
    expect(path).not.toMatch(/NaN|undefined/);
    expect(view.container.querySelector('circle[pointer-events="all"]')).toHaveAttribute('r', size === 'large' ? '60' : '90');
    expect(view.getByTestId('artwork')).toHaveAttribute('clip-path', 'url(#actor-trim-a)');
    expect(actor.size).toBe(size);
    view.unmount();
  }
});

it('skips square grids and small/medium tokens', () => {
  for (const [type, size] of [['square', 'large'], ['hex-flat', 'small'], ['hex-pointy', 'medium']] as const) {
    const state = createActor(createEncounterState({ id: type, name: type }), { id: 'a', currentZoneId: 'zoneless', size });
    state.grid.type = type;
    Object.assign(state.movementRules, { snapToGrid: true, trimTokens: true });
    const view = render(<svg><ActorTrim encounter={state} actor={state.actors.byId.a} point={{ x: 200, y: 200 }}>{id => <g data-testid="artwork" data-clip={id} />}</ActorTrim></svg>);
    expect(view.container.querySelector('clipPath')).toBeNull();
    expect(view.getByTestId('artwork')).not.toHaveAttribute('data-clip');
    view.unmount();
  }
});
