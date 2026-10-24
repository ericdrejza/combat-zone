import { canvasFocusPoint, projectedFocusPoint } from '@ui/canvas/focus/focusCoordinates';

it('maps GM coordinates through zoomed SVG bounds and excludes canvas letterboxes', () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1000 500');
  svg.getBoundingClientRect = () => ({ left: 100, top: 50, width: 1000, height: 1000 } as DOMRect);
  expect(canvasFocusPoint({ x: 600, y: 550 }, svg)).toEqual({ x: 500, y: 250 });
  expect(canvasFocusPoint({ x: 600, y: 100 }, svg)).toBeNull();
});

it('maps preview input through both letterboxes into the same world coordinates', () => {
  const surface = document.createElement('div');
  surface.getBoundingClientRect = () => ({ left: 100, top: 50, width: 1000, height: 1000 } as DOMRect);
  const region = { x: 200, y: 100, width: 400, height: 300 };
  expect(projectedFocusPoint({ x: 600, y: 550 }, surface, region, { width: 16, height: 9 })).toEqual({ x: 400, y: 250 });
  expect(projectedFocusPoint({ x: 110, y: 550 }, surface, region, { width: 16, height: 9 })).toBeNull();
  expect(projectedFocusPoint({ x: 600, y: 60 }, surface, region, { width: 16, height: 9 })).toBeNull();
});
