import { Trash2 } from "lucide-react";
import { motion } from "motion/react";

import type { SelectionState } from "@interaction/selection/types";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";

type CompactSelectionDeleteButtonProps = {
  activeToolId: ToolId;
  onDelete: () => void;
  selection: SelectionState;
};

const matchingToolByEntity = {
  actor: "actor",
  edge: "edge",
  zone: "zone"
} as const;

/** Exposes touch deletion only when the active entity tool owns the selection. */
export function CompactSelectionDeleteButton({
  activeToolId,
  onDelete,
  selection
}: CompactSelectionDeleteButtonProps) {
  const entityType = selection.selectedEntityType;
  if (
    !entityType ||
    !(entityType in matchingToolByEntity) ||
    matchingToolByEntity[entityType as keyof typeof matchingToolByEntity] !== activeToolId ||
    selection.selectedIds.length === 0
  ) {
    return null;
  }

  const count = selection.selectedIds.length;
  const label = count === 1
    ? `Delete selected ${entityType}`
    : `Delete ${count} selected ${entityType}s`;

  return (
    <div className="absolute bottom-3 left-2 z-30">
      <TouchTooltip label={label}>
        <motion.button
          aria-label={label}
          className="flex h-11 min-w-11 items-center justify-center rounded-full border border-red-200 bg-red-50 px-2 text-red-700 shadow-lg transition hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          onClick={onDelete}
          title={label}
          type="button"
          whileTap={{ scale: 0.94 }}
        >
          <Trash2 aria-hidden="true" className="h-5 w-5" />
        </motion.button>
      </TouchTooltip>
    </div>
  );
}
