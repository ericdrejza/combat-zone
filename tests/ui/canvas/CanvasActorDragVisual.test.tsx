import { render } from "@testing-library/react";
import { motionValue } from "motion/react";
import { createEncounterState } from "@core/encounter/createEncounterState";
import { createActor } from "@entities/actor/actorMutations";
import { CanvasActorDragVisual } from "@ui/canvas/CanvasActorDragVisual";
import { LiveSceneMotionProvider, useLiveSceneMotion } from "@ui/player_view/LiveSceneMotion";

// Capture Motion's input tracks, rather than asserting generated CSS/SVG styling.
const tracks = vi.hoisted(() => [] as Array<{ x?: unknown; y?: unknown; animate?: unknown }>);
vi.mock("motion/react", async importOriginal => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, motion: { g: ({ children, style, animate }: {
    children: import("react").ReactNode;
    style?: { x?: unknown; y?: unknown };
    animate?: unknown;
  }) => { tracks.push({ x: style?.x, y: style?.y, animate }); return <g>{children}</g>; } } };
});
vi.mock("@ui/canvas/actors/ActorVisual", () => ({ ActorVisual: () => null }));

const liveX = motionValue(112), liveY = motionValue(108);
function OriginalActorTrack() {
  useLiveSceneMotion("actor-a-x", liveX);
  useLiveSceneMotion("actor-a-y", liveY);
  return null;
}

function props() {
  const encounter = createActor(createEncounterState({ id: "drag", name: "Drag" }), { id: "a", currentZoneId: "zoneless" });
  const canvas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return {
    canvas, encounter, canvasLuminance: 1, zoneLuminance: {}, showFactionOutlines: false,
    placements: [{ actor: encounter.actors.byId.a, point: { x: 100, y: 100 }, radius: 30 }],
    drag: { actorId: "a", actorIds: ["a"], phase: "dragging" as const, hasMoved: true,
      start: { x: 100, y: 100 }, current: { x: 104, y: 102 } }
  };
}

beforeEach(() => { tracks.length = 0; liveX.set(112); liveY.set(108); });

it("hands off to the token's current Motion position instead of the older React drag snapshot", () => {
  render(<LiveSceneMotionProvider><OriginalActorTrack /><CanvasActorDragVisual {...props()} /></LiveSceneMotionProvider>);
  const track = tracks[tracks.length - 1]!;
  expect(track.x).toBe(liveX);
  expect(track.y).toBe(liveY);
  expect(track.animate).toBeUndefined();
  liveX.set(120); liveY.set(114);
  // The same subscribed tracks advance without waiting for another drag-state render.
  expect((track.x as typeof liveX).get()).toBe(120);
  expect((track.y as typeof liveY).get()).toBe(114);
});

it("retains snapshot positioning when no shared scene motion provider exists", () => {
  render(<CanvasActorDragVisual {...props()} />);
  expect(tracks[tracks.length - 1]).toEqual({ x: undefined, y: undefined, animate: { x: 104, y: 102 } });
});
