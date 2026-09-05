import type { DragEvent } from "react";

export const LIBRARY_NODE_DRAG_TYPE =
  "application/x-combat-zone-library-node";

export function hasInternalLibraryNode(event: DragEvent<Element>) {
  return Array.from(event.dataTransfer.types).includes(LIBRARY_NODE_DRAG_TYPE);
}

export function hasExternalFiles(event: DragEvent<Element>) {
  return (
    !hasInternalLibraryNode(event) &&
    Array.from(event.dataTransfer.types).includes("Files")
  );
}

/** Distinguishes leaving a drop surface from bubbling across its descendants. */
export function hasLeftDragSurface(event: DragEvent<HTMLElement>) {
  const nextTarget = event.relatedTarget;

  if (
    nextTarget instanceof Node &&
    event.currentTarget.contains(nextTarget)
  ) {
    return false;
  }

  const bounds = event.currentTarget.getBoundingClientRect();

  return (
    event.clientX <= bounds.left ||
    event.clientX >= bounds.right ||
    event.clientY <= bounds.top ||
    event.clientY >= bounds.bottom
  );
}
