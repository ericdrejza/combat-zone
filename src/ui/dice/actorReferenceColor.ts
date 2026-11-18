import { ACTOR_LAYOUT_GROUP_COLORS } from "@entities/actor/actorVisuals";
import type { ActorLayoutGroup } from "@entities/actor/types";
import type { Theme } from "@ui/theme/ThemeProvider";

/** Lighter faction hues meet AA normal-text contrast on the dark Log card surface. */
const DARK_REFERENCE_COLORS: Record<ActorLayoutGroup, string> = {
  ally: "#4ade80", enemy: "#f87575", hero: "#60a5fa", neutral: "#facc15"
};

/** Adapt saved faction colors for display without changing historical reference snapshots. */
export function actorReferenceColor(color: string | null, theme: Theme): string | null {
  if (!color || theme !== "dark") return color;
  const faction = (Object.keys(ACTOR_LAYOUT_GROUP_COLORS) as ActorLayoutGroup[])
    .find(group => ACTOR_LAYOUT_GROUP_COLORS[group].fill.toLowerCase() === color.toLowerCase());
  return faction ? DARK_REFERENCE_COLORS[faction] : color;
}
