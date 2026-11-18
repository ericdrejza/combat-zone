import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { TARGET_PREVIEW_EVENT } from "./MentionSuggestions";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
export function ActorTargetPreview({ actorId, radius, color, rectangle }: { actorId: string; radius: number; color: string; rectangle: boolean }) {
  const [target, setTarget] = useState<string[]>([]);
  const { animationsDisabled } = useMotionPreference();
  useEffect(() => { const listener = (e: Event) => setTarget((e as CustomEvent<string[]>).detail); window.addEventListener(TARGET_PREVIEW_EVENT, listener); return () => window.removeEventListener(TARGET_PREVIEW_EVENT, listener); }, []);
  if (!target.includes(actorId)) return null;
  const props = { fill: "none", stroke: color, strokeWidth: 4, pointerEvents: "none" as const, initial: false as const, animate: { opacity: animationsDisabled ? 1 : [1, 0.35, 1] }, transition: { duration: 1, repeat: animationsDisabled ? 0 : Infinity } };
  return rectangle ? <motion.rect {...props} x={-radius - 4} y={-radius - 4} width={(radius + 4) * 2} height={(radius + 4) * 2} /> : <motion.circle {...props} r={radius + 4} />;
}
