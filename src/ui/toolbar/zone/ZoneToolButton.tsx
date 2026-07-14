import { useDispatch } from "react-redux";

import type { ZoneShape } from "../../../entities/zone/types";
import {
  setActiveTool,
  setZoneShapeMode
} from "../../../interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "../../../interaction/tools/toolRegistry";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarOptionKeybind,
  ToolbarOptionRow
} from "../ToolbarOption";
import { ZONE_SHAPE_OPTIONS } from "../toolbarItems";

type ZoneToolButtonProps = {
  activeToolId: ToolId;
  tool: ToolDefinition;
  zoneShapeMode: ZoneShape;
};

export function ZoneToolButton({
  activeToolId,
  tool,
  zoneShapeMode
}: ZoneToolButtonProps) {
  const dispatch = useDispatch();
  const selected = activeToolId === "zone";
  const toolButtonClassName = selected
    ? "border-canvas-ink bg-canvas-ink text-white"
    : "border-canvas-line bg-white text-canvas-ink";

  return (
    <ToolbarOptionRow>
      <button
        aria-expanded={selected}
        aria-haspopup="true"
        aria-pressed={selected}
        className={
          "rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas " +
          toolButtonClassName
        }
        onClick={() => {
          dispatch(setActiveTool("zone"));
        }}
        title={tool.tooltip}
        type="button"
      >
        {tool.label}
      </button>
      {selected ? (
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
      ) : null}
    </ToolbarOptionRow>
  );
}
