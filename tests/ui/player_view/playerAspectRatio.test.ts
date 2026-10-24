import { normalizePlayerAspectRatio, playerProjectionSize, validPlayerAspectRatio } from '@ui/player_view/playerAspectRatio';
import { CANVAS_PREFERENCES_KEY, readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';

afterEach(() => localStorage.removeItem(CANVAS_PREFERENCES_KEY));

it.each([null, {}, { width: 0, height: 9 }, { width: -1, height: 9 }, { width: 1.5, height: 9 }, { width: Infinity, height: 9 }, { width: '16', height: 9 }])('rejects invalid ratios: %j', value => {
  expect(validPlayerAspectRatio(value)).toBe(false);
});

it('uses equivalent ratios for identical frames regardless of former pixel resolution', () => {
  expect(normalizePlayerAspectRatio({ width: 3840, height: 2160 })).toEqual({ width: 16, height: 9 });
  expect(playerProjectionSize({ width: 16, height: 9 })).toEqual({ width: 1920, height: 1080 });
  expect(playerProjectionSize({ width: 4, height: 3 })).toEqual({ width: 1440, height: 1080 });
  expect(playerProjectionSize({ width: 9, height: 16 })).toEqual({ width: 607.5, height: 1080 });
});

it.each([{ width: 3840, height: 2160 }, { width: 1080, height: 1920 }])('migrates saved resolution without losing its aspect ratio: %j', projectedResolution => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ projectedResolution }));
  expect(readCanvasPreferences().playerAspectRatio).toEqual(normalizePlayerAspectRatio(projectedResolution));
});

it('prefers the new aspect ratio over the legacy resolution', () => {
  localStorage.setItem(CANVAS_PREFERENCES_KEY, JSON.stringify({ playerAspectRatio: { width: 4, height: 3 }, projectedResolution: { width: 1920, height: 1080 } }));
  expect(readCanvasPreferences().playerAspectRatio).toEqual({ width: 4, height: 3 });
});
