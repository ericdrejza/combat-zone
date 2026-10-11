import { DEFAULT_ISOMETRIC_ANGLE } from '@core/movement/types';
import type { ReactNode } from 'react';
import { motion, type Transition } from 'motion/react';

/** Presentation-only lattice projection; the placement parent stays in world space. */
export function ActorProjection({ rotation, angle = DEFAULT_ISOMETRIC_ANGLE, transition, children }: {
  rotation?: number; angle?: number; transition: Transition; children: ReactNode;
}) {
  const projected = rotation !== undefined;
  return <motion.g initial={false} animate={{ rotate: rotation ?? 0 }}
    style={{ transformOrigin: '0px 0px' }} transition={transition}
    data-isometric-projection={projected ? 'true' : undefined}>
    <motion.g initial={false} style={{ transformOrigin: '0px 0px' }}
      animate={{ rotate: projected ? 45 : 0, scaleX: projected ? Math.SQRT1_2 : 1, scaleY: projected ? Math.SQRT1_2 * Math.tan(angle * Math.PI / 180) : 1 }}
      transition={transition}>{children}</motion.g>
  </motion.g>;
}
