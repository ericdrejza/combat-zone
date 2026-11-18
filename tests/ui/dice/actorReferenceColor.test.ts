import { expect, it } from "vitest";
import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import { actorReferenceColor } from "@ui/dice/actorReferenceColor";
import { getHexLuminance } from "@ui/canvas/canvasLuminance";

it.each(Object.entries(ACTOR_LAYOUT_GROUP_COLORS))('meets AA normal-text contrast for %s references on the dark Log card', (_group, { fill }) => {
  const background = getHexLuminance('#343438');
  const foreground = getHexLuminance(actorReferenceColor(fill, 'dark')!);
  const contrast = (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
it('preserves saved colors, light-theme colors, and unrecognized historical colors', () => {
  for (const { fill } of Object.values(ACTOR_LAYOUT_GROUP_COLORS)) expect(actorReferenceColor(fill, 'light')).toBe(fill);
  expect(actorReferenceColor('#123456', 'dark')).toBe('#123456');
  expect(actorReferenceColor(null, 'dark')).toBeNull();
});
