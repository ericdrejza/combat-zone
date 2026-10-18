import { motion, type MotionValue, type Transition } from "motion/react";

import { SelectionOutline } from "@core/rendering/SelectionOutline";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { useSelectionOutlineMode } from "@ui/canvas/useSelectionOutlineMode";

export function ZoneSelectionOutline({ color, points, transition }: {
  color: string;
  points: string | MotionValue<string>;
  transition: Transition;
}) {
  const { zoneSelectionOutlineWidth, zoneBorderThickness } = useInterfacePreferences();
  const mode = useSelectionOutlineMode("zone");
  return (
    <SelectionOutline mode={mode}>
      <motion.polygon
        points={points}
        animate={{ stroke: color, strokeDasharray: "8 8", strokeWidth: Math.max(zoneBorderThickness, zoneSelectionOutlineWidth) }}
        className="pointer-events-none fill-none"
        initial={false}
        transition={transition}
      />
    </SelectionOutline>
  );
}
