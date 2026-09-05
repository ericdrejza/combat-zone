import { useMotionValue, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { LibraryNode } from "@library/types";

const DRAG_THRESHOLD_PX = 8;
const DROP_FOLDER_SELECTOR = "[data-library-drop-folder-id]";

export type LibraryPointerDragPreview = {
  label: string;
  x: MotionValue<number>;
  y: MotionValue<number>;
} | null;

type Options = {
  enabled: boolean;
  onDragEnd: () => void;
  onDragStart: (nodeId: string) => void;
  onDrop: (nodeId: string, folderId: string) => void;
  onTargetChange: (folderId: string | null) => void;
};

function folderAtPoint(clientX: number, clientY: number) {
  const target = document.elementFromPoint(clientX, clientY);
  return target
    ?.closest<HTMLElement>(DROP_FOLDER_SELECTOR)
    ?.dataset.libraryDropFolderId ?? null;
}

function suppressClickFromCompletedDrag() {
  const suppress = (event: MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener("click", suppress, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener("click", suppress, true), 0);
}

/** Moves library nodes without entering the browser's blocking native drag loop. */
export function useLibraryNodePointerDrag({
  enabled,
  onDragEnd,
  onDragStart,
  onDrop,
  onTargetChange
}: Options) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const cancelActiveRef = useRef<(() => void) | null>(null);
  const [preview, setPreview] = useState<LibraryPointerDragPreview>(null);

  useEffect(() => {
    const cancel = () => cancelActiveRef.current?.();
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, []);

  function startPointerDrag(
    event: ReactPointerEvent<HTMLElement>,
    node: LibraryNode
  ) {
    if (!enabled || event.button !== 0) return;

    cancelActiveRef.current?.();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let dragging = false;
    let targetFolderId: string | null = null;

    const removeListeners = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
    const finish = (commit: boolean) => {
      removeListeners();
      cancelActiveRef.current = null;
      if (!dragging) return;

      if (commit && targetFolderId) {
        onDrop(node.id, targetFolderId);
      }
      onTargetChange(null);
      onDragEnd();
      setPreview(null);
    };
    function handleMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;

      if (!dragging) {
        if (
          Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) <
          DRAG_THRESHOLD_PX
        ) {
          return;
        }
        dragging = true;
        x.set(moveEvent.clientX);
        y.set(moveEvent.clientY);
        setPreview({ label: node.name, x, y });
        onDragStart(node.id);
      }

      moveEvent.preventDefault();
      x.set(moveEvent.clientX);
      y.set(moveEvent.clientY);
      const nextTarget = folderAtPoint(moveEvent.clientX, moveEvent.clientY);
      if (nextTarget !== targetFolderId) {
        targetFolderId = nextTarget;
        onTargetChange(nextTarget);
      }
    }
    function handleUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      if (dragging) {
        upEvent.preventDefault();
        suppressClickFromCompletedDrag();
      }
      finish(true);
    }
    function handleCancel(cancelEvent: PointerEvent) {
      if (cancelEvent.pointerId === pointerId) finish(false);
    }

    cancelActiveRef.current = () => finish(false);
    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  }

  return { preview, startPointerDrag };
}
