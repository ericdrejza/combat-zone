import { rulerLabelPosition } from '@ui/canvas/ruler/RulerLabel';

it.each([{ x: -30, y: -20 }, { x: 300, y: 200 }, { x: 1000, y: 1000 }])('keeps complete captions inside the map at %j', point => {
  const bounds = { width: 300, height: 200 }, width = 150;
  const position = rulerLabelPosition(point, bounds, width);
  expect(position.x).toBeGreaterThanOrEqual(0); expect(position.x + width).toBeLessThanOrEqual(bounds.width);
  expect(position.y).toBeGreaterThanOrEqual(16); expect(position.y).toBeLessThanOrEqual(bounds.height);
});
it('fits long artifact captions into the available canvas width', () => {
  const position = rulerLabelPosition({ x: 300, y: 200 }, { width: 300, height: 200 }, 1000);
  expect(position.x + position.available).toBeLessThanOrEqual(300);
});
