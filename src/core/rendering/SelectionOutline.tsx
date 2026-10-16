import { motion } from "motion/react";
import type { ReactNode } from "react";

export type SelectionOutlineMode = "static" | "pulse" | "pulse_limited";

const PULSE_OPACITY = [1, 0.35, 1];

/** Mounting a newly selected outline starts its pulses; geometry updates do not. */
export function SelectionOutline({ children, mode }: {
  children: ReactNode;
  mode: SelectionOutlineMode;
}) {
  return (
    <motion.g
      key={mode}
      pointerEvents="none"
      initial={{ opacity: 1 }}
      animate={{ opacity: mode === "static" ? 1 : PULSE_OPACITY }}
      transition={{
        duration: mode === "static" ? 0 : 1,
        ease: "easeInOut",
        repeat: mode === "pulse" ? Infinity : mode === "pulse_limited" ? 1 : 0
      }}
    >
      {children}
    </motion.g>
  );
}
