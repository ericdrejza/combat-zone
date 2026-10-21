import { ActorConditionBadge } from "./ActorConditionBadge";
import { type Transition } from "motion/react";
import type { Actor } from "@entities/actor/types";
import { CONDITION_GROUPS } from "@ui/status/markerCatalog";

const BADGE_SIZE = 16;
const GAP = 2;

/** Active conditions stay upright, with each group wrapping upward over its token corner. */
export function ActorConditionIcons({ actor, radius, top, transition, selected }: {
  actor: Actor; radius: number; top: number; transition: Transition; selected: boolean;
}) {
  const columns = actor.size === "small" || actor.size === "medium" ? 2 :
    Math.max(1, Math.floor((radius - GAP) / (BADGE_SIZE + GAP)));
  const groupWidth = columns * (BADGE_SIZE + GAP) - GAP;
  // Small tokens need the badges to extend outward so paired two-column groups do not overlap.
  const corner = Math.max(radius, groupWidth + GAP / 2);
  return <g pointerEvents="none">
    {CONDITION_GROUPS.map(({ title, markers }, groupIndex) => {
      const active = markers.filter(({ id }) => actor.statusEffects.includes(id));
      if (!active.length) return null;
      const right = groupIndex === 1;
      return <g key={title} role="group" aria-label={`${actor.name} ${title.toLowerCase()}`}>
        {active.map((marker, index) => {
          const column = index % columns;
          const row = Math.floor(index / columns);
          const x = right ? corner - BADGE_SIZE - column * (BADGE_SIZE + GAP) : -corner + column * (BADGE_SIZE + GAP);
          const y = top - BADGE_SIZE - row * (BADGE_SIZE + GAP);
          return <ActorConditionBadge key={marker.id} marker={marker} selected={selected}
            x={x} y={y} size={BADGE_SIZE} transition={transition} />;
        })}
      </g>;
    })}
  </g>;
}
