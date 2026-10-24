import { clampPlayerRegion, playerFrame, visibleCanvasRegion } from '@ui/player_view/playerCamera';

it('matches the exact GM region, including centered blank space', () => {
  expect(visibleCanvasRegion({ width: 1000, height: 600 }, { width: 800, height: 800 }, 1, 100, 0))
    .toEqual({ x: 100, y: -100, width: 800, height: 800 });
  expect(visibleCanvasRegion({ width: 1000, height: 600 }, { width: 800, height: 600 }, 2, 200, 120))
    .toEqual({ x: 100, y: 60, width: 400, height: 300 });
});

it('letterboxes the same region across resolutions without cropping', () => {
  const region = { x: 100, y: 60, width: 400, height: 300 };
  expect(playerFrame(region, { width: 1920, height: 1080 })).toEqual({ scale: 3.6, x: 240, y: 0 });
  expect(playerFrame(region, { width: 600, height: 600 })).toEqual({ scale: 1.5, x: 0, y: 75 });
});

it('clamps independent panning and centers axes smaller than the region', () => {
  expect(clampPlayerRegion({ x: -200, y: 900, width: 200, height: 100 }, { width: 1000, height: 600 }))
    .toEqual({ x: 0, y: 500, width: 200, height: 100 });
  expect(clampPlayerRegion({ x: 100, y: -10, width: 1200, height: 800 }, { width: 1000, height: 600 }))
    .toEqual({ x: -100, y: -100, width: 1200, height: 800 });
});
