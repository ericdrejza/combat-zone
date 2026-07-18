import type { Transition } from "motion/react";

export const DIRECT_MANIPULATION_TRANSITION: Transition = { duration: 0 };

export const CANVAS_SPRING_TRANSITION: Transition = {
  damping: 30,
  mass: 0.55,
  stiffness: 420,
  type: "spring"
};

/** Returns an immediate track for direct manipulation or reduced motion. */
export function getCanvasTransition(
  immediate: boolean,
  prefersReducedMotion: boolean
): Transition {
  return immediate || prefersReducedMotion
    ? DIRECT_MANIPULATION_TRANSITION
    : CANVAS_SPRING_TRANSITION;
}
