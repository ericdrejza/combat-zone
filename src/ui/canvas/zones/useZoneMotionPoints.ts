import { useLayoutEffect } from 'react';
import { animate, useMotionValue, type Transition } from 'motion/react';

/** A new drag must stop even an unchanged target's in-flight points animation. */
export function useZoneMotionPoints(target: string, direct: boolean, transition: Transition, gesture: number) {
  const points = useMotionValue(target);
  useLayoutEffect(() => {
    if (direct) { points.jump(target); return; }
    const animation = animate(points, target, transition);
    return () => animation.stop();
  }, [target, direct, transition, gesture, points]);
  return points;
}
