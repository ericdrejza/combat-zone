import { useDispatch } from "react-redux";

import { setActiveTool } from "../../interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "../../interaction/tools/toolRegistry";

type ToolButtonProps = {
  activeToolId: ToolId;
  onSelected?: () => void;
  tool: ToolDefinition;
};

export function ToolButton({
  activeToolId,
  onSelected,
  tool
}: ToolButtonProps) {
  const dispatch = useDispatch();
  const selected = activeToolId === tool.id;

  return (
    <button
      aria-pressed={selected}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
        selected
          ? "border-canvas-ink bg-canvas-ink text-white"
          : "border-canvas-line bg-white text-canvas-ink"
      }`}
      onClick={() => {
        dispatch(setActiveTool(tool.id));
        onSelected?.();
      }}
      title={tool.tooltip}
      type="button"
    >
      {tool.label}
    </button>
  );
}
