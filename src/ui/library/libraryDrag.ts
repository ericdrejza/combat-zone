import type { DragEvent } from "react";

export const LIBRARY_NODE_DRAG_TYPE =
  "application/x-combat-zone-library-node";

export function hasInternalLibraryNode(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes(LIBRARY_NODE_DRAG_TYPE);
}

export function hasExternalFiles(event: DragEvent<HTMLElement>) {
  return (
    !hasInternalLibraryNode(event) &&
    Array.from(event.dataTransfer.types).includes("Files")
  );
}
