import { motion, type Transition } from 'motion/react';
import { SelectionOutline } from '@core/rendering/SelectionOutline';
import type { ActorShape } from '@entities/actor/types';
import { useSelectionOutlineMode } from '@ui/canvas/useSelectionOutlineMode';

/** Keep the selection geometry and animation independent of its sampled surface color. */
export function ActorSelectionOutline({ shape, radius, color, width, transition }: {
  shape: ActorShape;
  radius: number;
  color: string;
  width: number;
  transition: Transition;
}) {
  const mode = useSelectionOutlineMode('actor');

  return <SelectionOutline mode={mode}>
    {shape === 'circle' ? <motion.circle
        className="pointer-events-none fill-none"
        initial={false}
        animate={{ r: radius, strokeDasharray: '5 5', strokeWidth: width }}
        stroke={color}
        transition={transition}
      /> : <motion.rect
        className="pointer-events-none fill-none"
        initial={false}
        animate={{
          attrX: -radius,
          attrY: -radius,
          height: radius * 2,
          width: radius * 2,
          strokeDasharray: '5 5',
          strokeWidth: width
        }}
        rx="8"
        stroke={color}
        transition={transition}
      />
    }
  </SelectionOutline>;
}
