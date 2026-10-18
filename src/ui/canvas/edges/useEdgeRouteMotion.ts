import { animate, useMotionValue } from "motion/react";
import { useLayoutEffect } from "react";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { compatibleEdgePaths } from "./edgePathInterpolation";

/** Retarget from the currently displayed geometry, including interrupted animations. */
export function useEdgeRouteMotion(target: string, direct: boolean, pending: boolean) {
  const { animationsDisabled } = useMotionPreference();
  const path = useMotionValue(target);
  useLayoutEffect(() => {
    if (direct || animationsDisabled) {
      path.jump(target);
      return;
    }
    const [from, to] = compatibleEdgePaths(path.get(), target);
    path.jump(from);
    const animation = animate(path, to, { duration: pending ? 0.12 : 0.2, ease: "easeOut" });
    return () => animation.stop();
  }, [target, direct, pending, animationsDisabled, path]);
  return path;
}
