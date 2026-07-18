import { motion, type Transition } from "motion/react";

import type { Actor } from "@entities/actor/types";
import { getReadableTextColor } from "../canvasLuminance";

type ActorVisualProps = {
  actor: Actor;
  fillColor: string;
  outlineColor: string;
  radius: number;
  selected: boolean;
  selectedTextColor: string;
  showFactionOutline: boolean;
  clipId: string;
  transition: Transition;
};

/**
 * Renders the actor-local SVG geometry while its parent owns placement.
 * Radius-derived attributes share the placement transition so resizing and
 * layout changes remain visually synchronized.
 */
export function ActorVisual({
  actor,
  fillColor,
  outlineColor,
  radius,
  selected,
  selectedTextColor,
  showFactionOutline,
  clipId,
  transition
}: ActorVisualProps) {
  const innerRadius = Math.max(radius - 3, 1);
  const selectionRadius = radius + 5;
  const factionRadius = radius + 9;

  return (
    <>
      {actor.shape === "rectangle" ? (
        <motion.rect
          className="stroke-white"
          fill={fillColor}
          initial={false}
          animate={{
            attrX: -radius,
            attrY: -radius,
            height: radius * 2,
            strokeWidth: selected ? 4 : 2,
            width: radius * 2
          }}
          rx="6"
          transition={transition}
        />
      ) : (
        <motion.circle
          className="stroke-white"
          fill={fillColor}
          initial={false}
          animate={{ r: radius, strokeWidth: selected ? 4 : 2 }}
          transition={transition}
        />
      )}
      {actor.image ? (
        <>
          <clipPath id={clipId}>
            {actor.shape === "rectangle" ? (
              <motion.rect
                initial={false}
                animate={{
                  attrX: -innerRadius,
                  attrY: -innerRadius,
                  height: innerRadius * 2,
                  width: innerRadius * 2
                }}
                rx="4"
                transition={transition}
              />
            ) : (
              <motion.circle
                initial={false}
                animate={{ r: innerRadius }}
                transition={transition}
              />
            )}
          </clipPath>
          <motion.image
            clipPath={`url(#${clipId})`}
            href={actor.image}
            initial={false}
            animate={{
              attrX: -innerRadius,
              attrY: -innerRadius,
              height: innerRadius * 2,
              width: innerRadius * 2
            }}
            preserveAspectRatio="xMidYMid slice"
            transition={transition}
          />
        </>
      ) : (
        <text
          className="pointer-events-none text-[10px] font-bold"
          dominantBaseline="middle"
          fill={getReadableTextColor(fillColor)}
          textAnchor="middle"
        >
          {actor.name.toUpperCase()}
        </text>
      )}
      {selected ? (
        actor.shape === "rectangle" ? (
          <motion.rect
            className="pointer-events-none fill-none"
            initial={false}
            animate={{
              attrX: -selectionRadius,
              attrY: -selectionRadius,
              height: selectionRadius * 2,
              strokeDasharray: "5 5",
              strokeWidth: 2,
              width: selectionRadius * 2
            }}
            rx="8"
            stroke={selectedTextColor}
            transition={transition}
          />
        ) : (
          <motion.circle
            className="pointer-events-none fill-none"
            initial={false}
            animate={{
              r: selectionRadius,
              strokeDasharray: "5 5",
              strokeWidth: 2
            }}
            stroke={selectedTextColor}
            transition={transition}
          />
        )
      ) : null}
      {showFactionOutline ? (
        actor.shape === "rectangle" ? (
          <motion.rect
            className="pointer-events-none fill-none"
            initial={false}
            animate={{
              attrX: -factionRadius,
              attrY: -factionRadius,
              height: factionRadius * 2,
              strokeWidth: 4,
              width: factionRadius * 2
            }}
            rx="10"
            stroke={outlineColor}
            transition={transition}
          />
        ) : (
          <motion.circle
            className="pointer-events-none fill-none"
            initial={false}
            animate={{ r: factionRadius, strokeWidth: 4 }}
            stroke={outlineColor}
            transition={transition}
          />
        )
      ) : null}
      {selected && actor.image ? (
        <motion.text
          className="pointer-events-none text-[10px] font-bold z-10"
          dominantBaseline="middle"
          fill={selectedTextColor}
          initial={false}
          animate={{ dy: radius + 16 }}
          textAnchor="middle"
          transition={transition}
        >
          {actor.name.toUpperCase()}
        </motion.text>
      ) : null}
    </>
  );
}
