import { motion } from "motion/react";

import { ACTOR_TOKEN_BASE_RADIUS } from "@core/layout/actorFootprints";
import {
  ACTOR_LAYOUT_GROUP_COLORS,
  ACTOR_SIZE_MULTIPLIERS
} from "@entities/actor/actorVisuals";
import type { Actor } from "@entities/actor/types";
import { ZONELESS_ACTOR_ZONE_ID } from "@core/encounter/types";
import { ActorVisual } from "./actors/ActorVisual";
import type { CompactTransferPreview } from "./useCompactCanvasTransfer";

type Props = {
  preview: NonNullable<CompactTransferPreview>;
};

const DIRECT_POINTER_TRANSITION = { duration: 0 } as const;

/** Follows a canvas transfer without interpolation so the visual stays under the pointer. */
export function CanvasTransferPreview({ preview }: Props) {
  if (preview.actor) {
    const radius =
      ACTOR_TOKEN_BASE_RADIUS * ACTOR_SIZE_MULTIPLIERS[preview.actor.size];
    const diameter = radius * 2;
    const colors = ACTOR_LAYOUT_GROUP_COLORS[preview.actor.layoutGroup];
    const actor: Actor = {
      ...preview.actor,
      actorType: "creature",
      currentZoneId: ZONELESS_ACTOR_ZONE_ID,
      id: "actor-transfer-preview",
      metadata: {},
      statusEffects: []
    };

    return (
      <motion.div
        aria-label={`Dragging ${preview.label}`}
        className="pointer-events-none fixed left-0 top-0 z-[90] drop-shadow-lg"
        role="status"
        style={{
          marginLeft: -radius,
          marginTop: -radius,
          x: preview.clientX,
          y: preview.clientY
        }}
      >
        <svg
          aria-hidden="true"
          height={diameter}
          viewBox={`${-radius} ${-radius} ${diameter} ${diameter}`}
          width={diameter}
        >
          <ActorVisual
            actor={actor}
            clipId="actor-transfer-preview-clip"
            fillColor={colors.fill}
            outlineColor={colors.outline}
            radius={radius}
            selected={false}
            selectedTextColor="#ffffff"
            showFactionOutline={false}
            transition={DIRECT_POINTER_TRANSITION}
          />
        </svg>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[90] max-w-40 truncate rounded-full border border-canvas-line bg-canvas-panel px-3 py-2 text-sm font-medium shadow-lg"
      role="status"
      style={{
        marginLeft: 12,
        marginTop: 12,
        x: preview.clientX,
        y: preview.clientY
      }}
    >
      {preview.label}
    </motion.div>
  );
}
