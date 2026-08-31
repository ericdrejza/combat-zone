import { ListPlus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { setTouchMultiSelect } from "@interaction/interactionState";
import type { ToolId } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { TouchTooltip } from "./TouchTooltip";

type TouchSelectionToggleProps = {
  toolId: ToolId;
};

/** Touch modifier for toggling selection without a keyboard. */
export function TouchSelectionToggle({ toolId }: TouchSelectionToggleProps) {
  const dispatch = useDispatch();
  const enabled = useSelector(
    (state: RootState) => state.interaction.touchMultiSelect
  );
  const selectable = useSelector((state: RootState) =>
    state.interaction.activeToolId === toolId
      ? state.interaction.activeToolId !== "background"
      : false
  );

  if (!selectable) {
    return null;
  }

  return (
    <TouchTooltip label="Touch multi-select">
      <button
        aria-checked={enabled}
        aria-label="Touch multi-select"
        className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full border p-2 shadow-sm transition ${
          enabled
            ? "border-canvas-ink bg-canvas-ink text-white"
            : "border-canvas-line bg-white text-canvas-ink hover:bg-canvas"
        }`}
        onClick={() => dispatch(setTouchMultiSelect(!enabled))}
        role="switch"
        title="Touch multi-select"
        type="button"
      >
        <ListPlus aria-hidden="true" className="h-4 w-4" />
      </button>
    </TouchTooltip>
  );
}
