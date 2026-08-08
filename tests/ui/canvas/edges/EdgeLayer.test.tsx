import { render } from '@testing-library/react';

import { createEncounterState } from '@core/encounter/createEncounterState';
import { createOrReplaceEdge, DEFAULT_EDGE_PRESET } from '@entities/edge/edgeMutations';
import { buildZone } from '@entities/zone/zoneMutations';
import { EdgeLayer } from '@ui/canvas/edges/EdgeLayer';

function edgeLayerProps(canvasBackgroundLuminance: number) {
  const source = buildZone({
    id: 'source',
    name: 'Source',
    polygon: [{ x: 100, y: 100 }, { x: 220, y: 100 }, { x: 220, y: 220 }, { x: 100, y: 220 }],
    shape: 'rectangle'
  });
  const target = buildZone({
    id: 'target',
    name: 'Target',
    polygon: [{ x: 400, y: 100 }, { x: 520, y: 100 }, { x: 520, y: 220 }, { x: 400, y: 220 }],
    shape: 'rectangle'
  });
  const encounter = {
    ...createEncounterState({ id: 'edge-colors', name: 'Edge colors' }),
    zones: {
      allIds: ['source', 'target'],
      byId: { source, target }
    },
    edges: createOrReplaceEdge(
      createEncounterState({ id: 'edge-colors', name: 'Edge colors' }),
      { ...DEFAULT_EDGE_PRESET, fromZoneId: source.id, id: 'edge', toZoneId: target.id }
    ).nextEncounter.edges
  };

  return {
    activeToolId: 'select',
    edgeDrag: null,
    edgeTool: DEFAULT_EDGE_PRESET,
    encounter,
    canvasBackgroundLuminance,
    getDisplayedPolygon: (zone: typeof source) => zone.polygon,
    selection: { selectedEntityType: null, selectedIds: [], overlayTargets: [] }
  };
}

describe('EdgeLayer luminance colors', () => {
  it('uses white for valid paths and arrow markers on a dark canvas', () => {
    const { container } = render(
      <svg><EdgeLayer {...edgeLayerProps(0)} /></svg>
    );

    const path = container.querySelector('path[aria-label="bilateral edge from Source to Target"]');
    expect(path).toHaveAttribute('stroke', '#ffffff');
    expect(container.querySelector('#edge-arrow-end-edge path')).toHaveAttribute('fill', '#ffffff');
    expect(container.querySelector('#edge-arrow-start-edge path')).toHaveAttribute('fill', '#ffffff');
  });

  it('uses dark ink consistently for target and free creation previews on a light canvas', () => {
    const props = edgeLayerProps(255);
    const { container, rerender } = render(
      <svg><EdgeLayer {...props} edgeDrag={{ current: { x: 300, y: 160 }, sourceZoneId: 'source', start: { x: 160, y: 160 }, targetZoneId: 'target' }} activeToolId="edge" /></svg>
    );

    const targetPreview = container.querySelectorAll('path[aria-label="bilateral edge from Source to Target"]')[1];
    expect(targetPreview).toHaveAttribute('stroke', '#111827');
    expect(container.querySelector('#edge-arrow-end-edge-preview path')).toHaveAttribute('fill', '#111827');

    rerender(
      <svg><EdgeLayer {...props} edgeDrag={{ current: { x: 300, y: 300 }, sourceZoneId: 'source', start: { x: 160, y: 160 } }} activeToolId="edge" /></svg>
    );
    expect(container.querySelector('[data-edge-free-preview="true"]')).toHaveAttribute('stroke', '#111827');
    expect(container.querySelector('#edge-preview-arrow path')).toHaveAttribute('fill', '#111827');
  });
});
