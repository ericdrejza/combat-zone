import { expect, it } from "vitest";
import { actorGroupNavigationPoint } from "@ui/canvas/actorGroupNavigation";
const placements = [{ point: { x: 100, y: 100 }, radius: 20 }, { point: { x: 200, y: 140 }, radius: 30 }];
it('centers complete token bounds when all fit at the current zoom', () => {
  expect(actorGroupNavigationPoint(placements, { width: 400, height: 300 }, 2)).toEqual({ x: 155, y: 125 });
});
it('leaves the viewport unchanged when either dimension cannot contain all tokens', () => {
  expect(actorGroupNavigationPoint(placements, { width: 299, height: 300 }, 2)).toBeNull();
  expect(actorGroupNavigationPoint(placements, { width: 400, height: 179 }, 2)).toBeNull();
});
it('ignores unavailable geometry and invalid viewport measurements', () => {
  expect(actorGroupNavigationPoint([], { width: 400, height: 300 }, 1)).toBeNull();
  expect(actorGroupNavigationPoint(placements, { width: 0, height: 300 }, 1)).toBeNull();
  expect(actorGroupNavigationPoint(placements, { width: 400, height: 300 }, 0)).toBeNull();
});
