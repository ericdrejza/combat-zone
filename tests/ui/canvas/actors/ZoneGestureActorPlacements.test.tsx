import { renderHook } from '@testing-library/react';
import { createEncounterState } from '@core/encounter/createEncounterState';
import type { ZoneDragState } from '@ui/canvas/canvasInteractionTypes';
import { useZoneGestureActorPlacements } from '@ui/canvas/actors/useZoneGestureActorPlacements';
import { rebaseZoneActorPlacements } from '@ui/canvas/actors/rebaseZoneActorPlacements';
import { useZoneActorTranslation } from '@ui/canvas/useZoneActorTranslation';
import { transformZoneActorPoint } from '@ui/canvas/actors/actorPlacementTranslation';
import { collection, createActor, createZone } from './actorLayerTestFixtures';

function fixture() {
  const zone = createZone(), actor = createActor(zone.id);
  const encounter = { ...createEncounterState({ id: 'gesture-placement', name: 'Test' }), zones: collection([zone]), actors: collection([actor]) };
  encounter.movementRules.zoneLocked = true;
  const placements = [{ actor, point: { x: 150, y: 180 }, radius: 30 }];
  const drag: ZoneDragState = { gestureId: 1, zoneId: zone.id, phase: 'dragging', hasMoved: true,
    originalPolygon: zone.polygon, sourcePolygon: zone.polygon, start: { x: 0, y: 0 }, current: { x: 40, y: 20 } };
  return { zone, actor, encounter, placements, drag };
}

describe('Zone gesture Actor origins', () => {
  it('holds the gesture origin when packing publishes new positions', () => {
    const { encounter, placements, drag } = fixture();
    const { result, rerender } = renderHook(({ points }) => useZoneGestureActorPlacements(encounter, points, drag, null), { initialProps: { points: placements } });
    rerender({ points: [{ ...placements[0], point: { x: 250, y: 270 } }] });
    expect(result.current[0].point).toEqual(placements[0].point);
  });

  it('keeps the preview continuous when resize acceptance precedes gesture rebasing', () => {
    const { zone, encounter, placements, drag } = fixture();
    const polygon = zone.polygon.map(({ x, y }) => ({ x: 100 + (x - 100) * 2, y }));
    const pending = { ...drag, originalPolygon: polygon };
    const { result, rerender } = renderHook(({ state, points }) => {
      const frozen = useZoneGestureActorPlacements(state, points, pending, null);
      const transform = useZoneActorTranslation(state, pending);
      return transformZoneActorPoint(frozen[0].point, zone.id, transform);
    }, { initialProps: { state: encounter, points: placements } });
    expect(result.current).toEqual({ x: 240, y: 200 });
    const resized = { ...encounter, zones: collection([{ ...zone, polygon }]) };
    rerender({ state: resized, points: [{ ...placements[0], point: { x: 350, y: 250 } }] });
    expect(result.current).toEqual({ x: 240, y: 200 });
  });

  it('uses current packing after the gesture ends', () => {
    const { encounter, placements, drag } = fixture();
    const { result, rerender } = renderHook(({ active, points }) => useZoneGestureActorPlacements(encounter, points, active, null), {
      initialProps: { active: drag as ZoneDragState | null, points: placements }
    });
    const packed = [{ ...placements[0], point: { x: 240, y: 260 } }];
    rerender({ active: null, points: packed });
    expect(result.current).toBe(packed);
  });

  it('rebases a stale render before a same-frame follow-up commit', () => {
    const { zone, placements } = fixture();
    const polygon = zone.polygon.map(({ x, y }) => ({ x: 100 + (x - 100) * 2, y: y + 30 }));
    const rebased = rebaseZoneActorPlacements(placements, zone.id, zone.polygon, polygon);
    expect(rebased[0].point).toEqual({ x: 200, y: 210 });
    expect(placements[0].point).toEqual({ x: 150, y: 180 });
  });
});
