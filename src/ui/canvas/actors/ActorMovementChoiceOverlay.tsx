import { ChevronsDown, ChevronsLeft, ChevronsRight, ChevronsUp } from "lucide-react";
import { motion } from "motion/react";
import type { Zone } from "@entities/zone/types";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { zoneCenter, type MoveDirection } from "./directionalActorMovement";

/** Candidate highlighting belongs to transient overlays, not Zone selection state. */
export function ActorMovementChoiceOverlay({ zone, direction }: { zone: Zone; direction: MoveDirection }) {
  const { animationsDisabled } = useMotionPreference();
  const { enableAssetAnimation } = useInterfacePreferences();
  const point = zoneCenter(zone);
  const horizontal = direction === "left" || direction === "right";
  const First = horizontal ? ChevronsUp : ChevronsLeft;
  const Last = horizontal ? ChevronsDown : ChevronsRight;
  return <motion.g aria-label={`Movement destination ${zone.name}`} pointerEvents="none" className="text-canvas-ink" animate={{ opacity: animationsDisabled || !enableAssetAnimation ? 1 : [1, 0.35, 1] }} transition={{ duration: 1, repeat: Infinity }}>
    <polygon points={zone.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={4} strokeDasharray="8 4" />
    <First x={point.x - (horizontal ? 12 : 30)} y={point.y - (horizontal ? 30 : 12)} width={24} height={24} />
    <Last x={point.x + (horizontal ? -12 : 6)} y={point.y + (horizontal ? 6 : -12)} width={24} height={24} />
  </motion.g>;
}
