import { useContext, useId, useState } from 'react';
import { motion, useMotionValueEvent } from 'motion/react';
import { FocusLightContext, type FocusLight } from './FocusLightContext';

function FocusGraphic({ focus }: { focus: FocusLight }) {
  const [visible, setVisible] = useState(focus.visible.get());
  const glowId = `focus-glow-${useId().replace(/:/g, '')}`;
  useMotionValueEvent(focus.visible, 'change', setVisible);
  if (!visible) return null;
  const { color, glowIntensity } = focus.preferences;
  return <g role="img" aria-label="Focus light" pointerEvents="none">
    <defs><filter id={glowId} x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={1 + glowIntensity * 5} />
    </filter></defs>
    {glowIntensity > 0 ? <g filter={`url(#${glowId})`} opacity={glowIntensity}>
      <motion.path d={focus.trail} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />
      <motion.circle cx={focus.x} cy={focus.y} r={13} fill={color} />
    </g> : null}
    <motion.path d={focus.trail} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={0.65} />
    <motion.circle cx={focus.x} cy={focus.y} r={7} fill={color} />
    <motion.circle cx={focus.x} cy={focus.y} r={2} fill="white" />
  </g>;
}

/** Every output subscribes to the same coordinates and flowing trail. */
export function FocusLightLayer() {
  const focus = useContext(FocusLightContext);
  return focus ? <FocusGraphic focus={focus} /> : null;
}
