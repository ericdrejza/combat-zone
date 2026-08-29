import { ListPlus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { setTouchMultiSelect } from "@interaction/interactionState";
import type { ToolId } from "@interaction/tools/toolRegistry";
import type { RootState } from "@store/store";
import { ToolbarOptionButton } from "./ToolbarOption";

type TouchSelectionToggleProps = {
  toolId: ToolId;
};

/** Compact-only touch modifier for toggling selection without a keyboard. */
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
    <div className="lg:hidden">
      <ToolbarOptionButton
        active={enabled}
        aria-label="Touch multi-select"
        aria-checked={enabled}
        onClick={() => dispatch(setTouchMultiSelect(!enabled))}
        role="switch"
        title="Touch multi-select"
        type="button"
      >
        <ListPlus aria-hidden="true" className="h-4 w-4" />
      </ToolbarOptionButton>
    </div>
  );
}
