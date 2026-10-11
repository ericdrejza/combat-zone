import { motion, type HTMLMotionProps } from 'motion/react';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';

type Props = HTMLMotionProps<'aside'> & { visible: boolean };

/** Keep panel state mounted while fading it out of the canvas interaction area. */
export function ZonelessPanelVisibility({ visible, ...props }: Props) {
  const { animationsDisabled } = useMotionPreference();
  return (
    <motion.aside
      {...props}
      {...(!visible ? { inert: '' } : {})}
      aria-hidden={!visible}
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        visibility: 'visible',
        transitionEnd: { visibility: visible ? 'visible' : 'hidden' }
      }}
      transition={{ duration: animationsDisabled ? 0 : 0.2, ease: 'easeInOut' }}
      style={{ ...props.style, pointerEvents: visible ? undefined : 'none' }}
    />
  );
}
