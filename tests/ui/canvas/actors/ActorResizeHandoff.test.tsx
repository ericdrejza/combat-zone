import { act, render } from '@testing-library/react';
import { ActorMotionTrack } from '@ui/canvas/actors/ActorMotionTrack';
import { retainResizeActorPreview } from '@ui/canvas/actors/retainResizeActorPreview';
import { clearOptimisticActorPlacements, getOptimisticActorPlacement } from '@ui/canvas/actors/actorPlacementOptimisticState';
import { createActor, createZone } from './actorLayerTestFixtures';

// Capture Motion's requested coordinates directly, without asserting SVG styles.
describe('Actor resize placement handoff', () => {
  afterEach(clearOptimisticActorPlacements);

  it('retains proportional preview centers without changing Actors in other Zones', () => {
    const zone = createZone();
    const actor = createActor(zone.id);
    retainResizeActorPreview([
      { actor, point: { x: 200, y: 200 }, radius: 30 },
      { actor: { ...actor, id: 'other', currentZoneId: 'other-zone' }, point: { x: 500, y: 500 }, radius: 30 }
    ], zone.id, zone.polygon, zone.polygon.map(({ x, y }) => ({ x: 100 + (x - 100) * 2, y })));
    expect(getOptimisticActorPlacement(actor.id)).toEqual({ x: 300, y: 200 });
    expect(getOptimisticActorPlacement('other')).toBeUndefined();
  });

  it('starts final packing at the retained resize preview instead of the original position', () => {
    let coordinates: unknown;
    let complete: (() => unknown) | undefined;
    const children = (point: unknown, done: () => unknown) => {
      coordinates = point;
      complete = done;
      return null;
    };
    const preview = { x: 300, y: 200 };
    const { rerender } = render(<ActorMotionTrack direct target={preview}>{children}</ActorMotionTrack>);
    // Layout may first hold the optimistic preview while its worker is pending.
    rerender(<ActorMotionTrack direct={false} target={preview}>{children}</ActorMotionTrack>);
    act(() => { complete?.(); });
    rerender(<ActorMotionTrack direct={false} incomingPoint={preview} target={{ x: 320, y: 180 }}>{children}</ActorMotionTrack>);
    expect(coordinates).toEqual({ x: [300, 320], y: [200, 180] });
  });

  it('ignores old animation completions and direct manipulation completions', () => {
    let complete!: () => unknown;
    const children = (_point: unknown, done: () => unknown) => { complete = done; return null; };
    const { rerender } = render(<ActorMotionTrack direct={false} incomingPoint={{ x: 100, y: 100 }} target={{ x: 200, y: 200 }}>{children}</ActorMotionTrack>);
    const oldComplete = complete;
    rerender(<ActorMotionTrack direct target={{ x: 250, y: 250 }}>{children}</ActorMotionTrack>);
    expect(oldComplete()).toBeNull();
    expect(complete()).toBeNull();
  });
});
