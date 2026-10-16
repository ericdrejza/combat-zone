import { motion, type Transition } from "motion/react";

import { SelectionOutline } from "@core/rendering/SelectionOutline";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { useSelectionOutlineMode } from "@ui/canvas/useSelectionOutlineMode";

export function ZoneSelectionOutline({ points, transition }: {
  points: string;
  transition: Transition;
}) {
  const { zoneSelectionOutlineWidth } = useInterfacePreferences();
  const mode = useSelectionOutlineMode("zone");
  return (
    <SelectionOutline mode={mode}>
      <motion.polygon
        animate={{ points, strokeDasharray: "8 8", strokeWidth: zoneSelectionOutlineWidth }}
        className="pointer-events-none fill-none stroke-canvas-ink"
        initial={false}
        transition={transition}
      />
    </SelectionOutline>
  );
}
