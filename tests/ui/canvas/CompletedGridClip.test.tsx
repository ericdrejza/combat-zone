import { render } from '@testing-library/react';
import { CompletedGridClip } from '@ui/canvas/grid/CompletedGridClip';
import { createEncounterState } from '@core/encounter/createEncounterState';
import { completeGridEdges } from '@core/movement/gridEdgeCompletion';
describe('finished grid outline', () => {
  it.each(['square', 'hex-flat', 'hex-pointy'] as const)('clips rotated %s grids to whole cells around the original map', type => {
    const initial = createEncounterState({ id: 'outline', name: 'Outline' });
    initial.grid = { ...initial.grid, type, rotation: 17, visible: true };
    initial.canvasSize = { width: 193, height: 193 };
    const state = completeGridEdges(initial);
    const { container } = render(<svg><defs><CompletedGridClip id="finished" grid={state.grid} encounter={state} /></defs></svg>);
    const rect = container.querySelector('rect')!;
    expect(rect.getAttribute('width')).toBe('193');
    expect(rect.getAttribute('height')).toBe('193');
    expect(container.querySelector('clipPath path')!.getAttribute('d')).toContain('Q');
    expect(state.canvasSize.width).toBeGreaterThan(193);
    expect(completeGridEdges(state)).toBe(state);
  });
});
