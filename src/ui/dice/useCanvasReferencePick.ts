import { useEffect, useRef, type RefObject } from "react";
import { useStore } from "react-redux";
import type { RootState } from "@store/store";
import { canToolSelectEntityType } from "@interaction/tools/toolRegistry";
import { canvasReferencePick, type ReferencePick } from "@core/dice/canvasReferencePick";

/** Observe completed canvas selections without intercepting or changing the active tool's behavior. */
export function useCanvasReferencePick({ inputRef, draft, caret, enabled, onPick }: {
  inputRef: RefObject<HTMLTextAreaElement>; draft: string; caret: number; enabled: boolean;
  onPick: (pick: ReferencePick) => void;
}) {
  const store = useStore<RootState>();
  const latest = useRef({ draft, caret, enabled, onPick });
  latest.current = { draft, caret, enabled, onPick };
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const documents = new Set([document, input.ownerDocument]);
    function click(event: MouseEvent) {
      const current = latest.current;
      if (!current.enabled || event.button !== 0 || event.detail > 1 || event.defaultPrevented) return;
      const target = event.target as Element | null;
      if (target?.nodeType !== 1 || !target.closest('svg[aria-label="SVG encounter workspace"]')) return;
      const entity = target.closest<SVGElement>("[data-entity-id][data-entity-type]");
      const kind = entity?.dataset.entityType;
      const id = entity?.dataset.entityId;
      if (!id || (kind !== "actor" && kind !== "zone" && kind !== "engagement")) return;
      const state = store.getState();
      const { selection, activeToolId } = state.interaction;
      if (!canToolSelectEntityType(activeToolId, kind) || selection.selectedEntityType !== kind || !selection.selectedIds.includes(id)) return;
      const pick = canvasReferencePick(state.encounter.present, current.draft, current.caret, kind, id);
      if (pick) current.onPick(pick);
    }
    // React's canvas handler commits selection before this native bubbling listener runs.
    for (const owner of documents) owner.addEventListener("click", click);
    return () => { for (const owner of documents) owner.removeEventListener("click", click); };
  }, [inputRef, store]);
}
