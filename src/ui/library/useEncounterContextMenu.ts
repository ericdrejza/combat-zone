import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import type { EncounterRecord } from "@core/persistence";
import type { EncounterContextMenuState } from "./AssetLibraryMenus";

/** Shares one encounter-action menu between the tree and content presentations. */
export function useEncounterContextMenu() {
  const [contextMenu, setContextMenu] = useState<EncounterContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    function dismissOnOutsidePointerDown(event: PointerEvent) {
      if (!contextMenuRef.current?.contains(event.target as Node)) {
        setContextMenu(null);
      }
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", dismissOnOutsidePointerDown);
  }, [contextMenu]);

  function openContextMenu(
    event: MouseEvent<HTMLElement>,
    record: EncounterRecord
  ) {
    event.preventDefault();
    setContextMenu({
      encounterId: record.id,
      name: record.state.name,
      x: event.clientX,
      y: event.clientY
    });
  }

  return { closeContextMenu: () => setContextMenu(null), contextMenu, contextMenuRef, openContextMenu };
}
