import { motion } from "motion/react";

import type { LibraryPointerDragPreview as Preview } from "./useLibraryNodePointerDrag";

/** Renders pointer drag feedback without copying image-backed source DOM. */
export function LibraryPointerDragPreview({
  preview
}: {
  preview: NonNullable<Preview>;
}) {
  return (
    <motion.div
      aria-label={`Dragging ${preview.label}`}
      className="pointer-events-none fixed left-0 top-0 z-[90] max-w-60 truncate rounded-full border border-canvas-line bg-white px-3 py-2 text-sm font-semibold text-canvas-ink shadow-lg"
      role="status"
      style={{ marginLeft: 12, marginTop: 12, x: preview.x, y: preview.y }}
    >
      {preview.label}
    </motion.div>
  );
}
