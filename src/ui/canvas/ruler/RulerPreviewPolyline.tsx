import { motion } from 'motion/react';
import { useMotionPreference } from '@ui/motion_preferences/MotionPreferenceProvider';

export const RULER_PREVIEW_SPRING = { type: 'spring', stiffness: 360, damping: 22, mass: 0.6 } as const;

/** Only the draft outline flows; saved geometry and hit targets stay exact. */
export function RulerPreviewPolyline({ points, flexible, area }: { points: string; flexible: boolean; area: boolean }) {
  const { animationsDisabled } = useMotionPreference();
  if (!flexible || animationsDisabled) return <polyline points={points} fill={area ? 'currentColor' : 'none'} fillOpacity={0.08} />;
  return <motion.polyline initial={false} animate={{ points }}
    transition={flexible && !animationsDisabled ? RULER_PREVIEW_SPRING : { duration: 0 }}
    fill={area ? 'currentColor' : 'none'} fillOpacity={0.08} />;
}
