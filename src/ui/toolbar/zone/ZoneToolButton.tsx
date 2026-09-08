import { useDispatch } from "react-redux";
import { createPortal } from "react-dom";

import type { ZoneShape } from "@entities/zone/types";
import {
  setActiveTool,
  setZoneShapeMode
} from "@interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "@interaction/tools/toolRegistry";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarOptionKeybind,
  ToolbarOptionRow,
  ToolbarSubtoolBar
} from "../ToolbarOption";
import { TOOL_ICONS, ZONE_SHAPE_OPTIONS } from "../toolbarItems";
import { TouchTooltip } from "../TouchTooltip";

type ZoneToolButtonProps = {
  activeToolId: ToolId;
  compactLayout: boolean;
  compactSubtoolHost: HTMLDivElement | null;
  tool: ToolDefinition;
  zoneShapeMode: ZoneShape;
};

export function ZoneToolButton({
  activeToolId,
  compactLayout,
  compactSubtoolHost,
  tool,
  zoneShapeMode
}: ZoneToolButtonProps) {
  const dispatch = useDispatch();
  const selected = activeToolId === "zone";
  const toolButtonClassName = selected
    ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
    : "border-canvas-line bg-canvas-surface text-canvas-ink";

  function renderOptions() {
    return (
      <ToolbarOptionGroup
        aria-label="Zone shape options"
        role="radiogroup"
      >
        {ZONE_SHAPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const optionSelected = zoneShapeMode === option.shape;

          return (
            <ToolbarOptionButton
              key={option.shape}
              aria-checked={optionSelected}
              aria-label={option.label + " zone shape"}
              active={optionSelected}
              onClick={() => {
                dispatch(setActiveTool("zone"));
                dispatch(setZoneShapeMode(option.shape));
              }}
              role="radio"
              title={option.label}
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <ToolbarOptionKeybind active={optionSelected}>
                {option.keybind}
              </ToolbarOptionKeybind>
            </ToolbarOptionButton>
          );
        })}
      </ToolbarOptionGroup>
    );
  }

  const ToolIcon = TOOL_ICONS[tool.id];
  const optionBar = selected ? (
    <ToolbarSubtoolBar aria-label="Zone shape options">
      {renderOptions()}
    </ToolbarSubtoolBar>
  ) : null;

  return (
    <>
      <ToolbarOptionRow className="max-lg:contents">
        <TouchTooltip label={tool.tooltip}>
          <button
            aria-expanded={selected}
            aria-haspopup="true"
            aria-label={tool.label}
            aria-pressed={selected}
            className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-medium shadow-sm transition hover:bg-canvas lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5 ${toolButtonClassName}`}
            onClick={() => {
              dispatch(setActiveTool("zone"));
            }}
            title={tool.tooltip}
            type="button"
          >
            <ToolIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        </TouchTooltip>
        {!compactLayout ? optionBar : null}
      </ToolbarOptionRow>
      {compactLayout && compactSubtoolHost && optionBar
        ? createPortal(optionBar, compactSubtoolHost)
        : null}
    </>
  );
}
