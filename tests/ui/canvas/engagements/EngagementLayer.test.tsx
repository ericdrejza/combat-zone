import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createEncounterState } from '@core/encounter/createEncounterState';
import type { EntityCollection } from '@core/state/entityCollection';
import { EngagementLayer } from '@ui/canvas/engagements/EngagementLayer';

function collection<TEntity extends { id: string }>(entities: TEntity[]): EntityCollection<TEntity> {
  return { allIds: entities.map((entity) => entity.id), byId: Object.fromEntries(entities.map((entity) => [entity.id, entity])) };
}

describe('EngagementLayer', () => {
  it('renders the packer-approved token and all lines instead of recomputing its centroid', () => {
    const encounter = {
      ...createEncounterState({ id: 'approved-token', name: 'Approved token' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 320, y: 0 }, { x: 320, y: 260 }, { x: 0, y: 260 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'c', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'C', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'obstacle', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'Obstacle', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'melee', parentZoneId: 'zone', participantIds: ['a', 'b', 'c'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const approvedToken = { x: 50, y: 150 };
    const { container } = render(
      <svg>
        <EngagementLayer
          activeToolId="select"
          actorDrag={null}
          backgroundLuminanceByZoneId={{ zone: 255 }}
          encounter={encounter}
          engagementDrag={null}
          onEngagementDrag={() => undefined}
          onEngagementDragEnd={() => undefined}
          onEngagementDragReturnComplete={() => undefined}
          onEngagementDragStart={() => undefined}
          onEngagementSelect={() => undefined}
          placements={[
            { actor: encounter.actors.byId.a!, engagementTokenPoint: approvedToken, point: { x: 100, y: 100 }, radius: 15 },
            { actor: encounter.actors.byId.b!, engagementTokenPoint: approvedToken, point: { x: 200, y: 100 }, radius: 15 },
            { actor: encounter.actors.byId.c!, engagementTokenPoint: approvedToken, point: { x: 150, y: 200 }, radius: 15 },
            { actor: encounter.actors.byId.obstacle!, point: { x: 150, y: 133 }, radius: 15 }
          ]}
          selection={{ selectedEntityType: null, selectedIds: [], overlayTargets: [] }}
        />
      </svg>
    );
    const lines = Array.from(container.querySelectorAll('line[data-engagement-connector]'));

    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveAttribute('x1', '50');
    expect(lines[0]).toHaveAttribute('y1', '150');
  });

  it('translates tokens and connectors with their moving zone', () => {
    const encounter = {
      ...createEncounterState({ id: 'zone-drag', name: 'Zone drag' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'melee', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const renderLayer = (
      zoneActorTranslation:
        | { offset: { x: number; y: number }; zoneId: string }
        | null
    ) => (
      <svg>
        <EngagementLayer
          activeToolId="select"
          actorDrag={null}
          backgroundLuminanceByZoneId={{ zone: 255 }}
          encounter={encounter}
          engagementDrag={null}
          onEngagementDrag={() => undefined}
          onEngagementDragEnd={() => undefined}
          onEngagementDragReturnComplete={() => undefined}
          onEngagementDragStart={() => undefined}
          onEngagementSelect={() => undefined}
          placements={[
            { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
            { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 }
          ]}
          selection={{ selectedEntityType: null, selectedIds: [], overlayTargets: [] }}
          zoneActorTranslation={zoneActorTranslation}
        />
      </svg>
    );
    const { container, rerender } = render(renderLayer(null));

    rerender(
      renderLayer({
        offset: { x: 40, y: -25 },
        zoneId: 'zone'
      })
    );
    const lines = Array.from(container.querySelectorAll('line[data-engagement-connector]'));

    expect(lines).toHaveLength(2);
    lines.forEach((line) => {
      expect(line).toHaveAttribute('x1', '185');
      expect(line).toHaveAttribute('y1', '75');
      expect(line).toHaveAttribute('y2', '75');
    });
    expect(lines.map((line) => line.getAttribute('x2')).sort()).toEqual([
      '110',
      '260'
    ]);
  });

  it('renders a 24px crossed-swords token in the layer behind actors', () => {
    const encounter = {
      ...createEncounterState({ id: 'test', name: 'Test' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorEngagement: '#fed7aa', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, matchEngagementColorToBorder: false, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'melee', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const onEngagementSelect = vi.fn();
    const { container } = render(<svg><EngagementLayer activeToolId="select" actorDrag={null} backgroundLuminanceByZoneId={{ zone: 255 }} encounter={encounter} engagementDrag={null} onEngagementDrag={() => undefined} onEngagementDragEnd={() => undefined} onEngagementDragReturnComplete={() => undefined} onEngagementDragStart={() => undefined} onEngagementSelect={onEngagementSelect} placements={[
      { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
      { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 }
    ]} selection={{ selectedEntityType: null, selectedIds: [], overlayTargets: [] }} /></svg>);
    expect(screen.getByLabelText('Engagement')).toBeInTheDocument();
    expect(container.querySelector('circle[r="12"]')).toHaveAttribute('stroke', '#fed7aa');
    expect(container.querySelector('circle[r="12"]')).toHaveAttribute('fill', '#fed7aa');
    const swordsIcon = container.querySelector('[aria-label="Crossed swords"]');
    expect(swordsIcon?.tagName.toLowerCase()).toBe('svg');
    expect(swordsIcon).toHaveAttribute('stroke', '#111827');
    fireEvent.click(container.querySelector('circle[r="12"]')!);
    fireEvent.click(container.querySelector('circle[r="12"]')!, {
      ctrlKey: true
    });
    fireEvent.click(container.querySelector('circle[r="12"]')!, {
      shiftKey: true
    });
    expect(onEngagementSelect).toHaveBeenNthCalledWith(1, 'melee', false);
    expect(onEngagementSelect).toHaveBeenNthCalledWith(2, 'melee', true);
    expect(onEngagementSelect).toHaveBeenNthCalledWith(3, 'melee', true);
  });

  it('keeps the dropped connector origin when the Motion return begins instead of jumping home', () => {
    const encounter = {
      ...createEncounterState({ id: 'drag', name: 'Drag' }),
      zones: collection([{ id: 'zone', colorBorder: '#f5f5f5', colorFill: '#fff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: false, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'melee', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const commonProps = {
      activeToolId: 'select' as const,
      actorDrag: null,
      backgroundLuminanceByZoneId: { zone: 255 },
      encounter,
      onEngagementDrag: () => undefined,
      onEngagementDragEnd: () => undefined,
      onEngagementDragReturnComplete: () => undefined,
      onEngagementDragStart: () => undefined,
      onEngagementSelect: () => undefined,
      placements: [
        { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
        { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 }
      ],
      selection: { selectedEntityType: null, selectedIds: [], overlayTargets: [] }
    };
    const { container, rerender } = render(
      <svg><EngagementLayer {...commonProps} engagementDrag={{ engagementId: 'melee', current: { x: 145, y: 160 }, hasMoved: true, phase: 'dragging', start: { x: 145, y: 100 } }} /></svg>
    );
    expect(container.querySelector('line[data-engagement-connector]')).toHaveAttribute('x1', '145');
    expect(container.querySelector('line[data-engagement-connector]')).toHaveAttribute('y1', '160');

    rerender(
      <svg><EngagementLayer {...commonProps} engagementDrag={{ engagementId: 'melee', current: { x: 145, y: 160 }, hasMoved: true, phase: 'returning', start: { x: 145, y: 100 } }} /></svg>
    );
    expect(container.querySelector('line[data-engagement-connector]')).toHaveAttribute('x1', '145');
    expect(container.querySelector('line[data-engagement-connector]')).toHaveAttribute('y1', '160');
    expect(container.querySelector('[aria-label="Crossed swords"]')).toHaveAttribute('stroke', '#111827');
  });

  it('outlines a token in its zone-name color when targeted by a merge drag', () => {
    const encounter = {
      ...createEncounterState({ id: 'target', name: 'Target' }),
      zones: collection([{ id: 'zone', colorBorder: '#123456', colorFill: '#ffffff', layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const, name: 'Zone', namePosition: 'top-left' as const, opacity: 1, polygon: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }], shape: 'rectangle' as const, showBorder: true, showName: true, tags: [] }]),
      actors: collection([
        { id: 'a', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'hero' as const, metadata: {}, name: 'A', shape: 'circle' as const, size: 'small' as const, statusEffects: [] },
        { id: 'b', actorType: 'creature' as const, currentZoneId: 'zone', layoutGroup: 'enemy' as const, metadata: {}, name: 'B', shape: 'circle' as const, size: 'small' as const, statusEffects: [] }
      ]),
      engagements: collection([{ id: 'target', parentZoneId: 'zone', participantIds: ['a', 'b'], layoutOrientation: 'LEFT_RIGHT' as const, layoutStrategy: 'FLEX' as const }])
    };
    const { container } = render(
      <svg>
        <EngagementLayer
          activeToolId="select"
          actorDrag={null}
          backgroundLuminanceByZoneId={{ zone: 255 }}
          encounter={encounter}
          engagementDrag={{ engagementId: 'source', current: { x: 145, y: 100 }, hasMoved: true, hoverTargetEngagementId: 'target', phase: 'dragging', start: { x: 0, y: 0 } }}
          onEngagementDrag={() => undefined}
          onEngagementDragEnd={() => undefined}
          onEngagementDragReturnComplete={() => undefined}
          onEngagementDragStart={() => undefined}
          onEngagementSelect={() => undefined}
          placements={[
            { actor: encounter.actors.byId.a!, point: { x: 70, y: 100 }, radius: 15 },
            { actor: encounter.actors.byId.b!, point: { x: 220, y: 100 }, radius: 15 }
          ]}
          selection={{ selectedEntityType: null, selectedIds: [], overlayTargets: [] }}
        />
      </svg>
    );

    expect(
      container.querySelector('[data-engagement-drop-target="true"]')
    ).toHaveAttribute('stroke', '#111827');
  });
});
