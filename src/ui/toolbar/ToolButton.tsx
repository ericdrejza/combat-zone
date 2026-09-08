import { useDispatch } from "react-redux";

import { setActiveTool } from "@interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "@interaction/tools/toolRegistry";
import { TOOL_ICONS } from "./toolbarItems";
import { TouchTooltip } from "./TouchTooltip";

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

  const Icon = TOOL_ICONS[tool.id];

  return (
    <TouchTooltip label={tool.tooltip}>
      <button
        aria-label={tool.label}
        aria-pressed={selected}
        className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-medium shadow-sm transition hover:bg-canvas lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5 ${
          selected
            ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
            : "border-canvas-line bg-canvas-surface text-canvas-ink"
        }`}
        onClick={() => {
          dispatch(setActiveTool(tool.id));
          onSelected?.();
        }}
        title={tool.tooltip}
        type="button"
      >
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="hidden lg:inline">{tool.label}</span>
      </button>
    </TouchTooltip>
  );
}
