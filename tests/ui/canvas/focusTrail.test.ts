import { advanceFocusTrail, focusTrailPath } from '@ui/canvas/focus/focusTrail';

it('keeps a longer trailing chain behind the precise pointer and settles at rest', () => {
  const target = { x: 120, y: 80 };
  const initial = Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
  const short = advanceFocusTrail(initial, target, 16, 10);
  let long = advanceFocusTrail(initial, target, 16, 80);
  expect(short[0].x).toBeGreaterThan(long[0].x);
  expect(long[0].x).toBeGreaterThan(long[7].x);
  for (let frame = 0; frame < 400; frame++) long = advanceFocusTrail(long, target, 16, 80);
  expect(long[7].x).toBeCloseTo(target.x, 2);
  expect(long[7].y).toBeCloseTo(target.y, 2);
  expect(focusTrailPath(target, long)).not.toMatch(/NaN|Infinity/);
});

it('collapses a disabled tail to the pointer and bounds catch-up after a paused frame', () => {
  const points = [{ x: 0, y: 0 }, { x: 0, y: 0 }], target = { x: 100, y: 50 };
  expect(advanceFocusTrail(points, target, 16, 0)).toEqual([target, target]);
  expect(advanceFocusTrail(points, target, 5000, 30)).toEqual(advanceFocusTrail(points, target, 64, 30));
});
