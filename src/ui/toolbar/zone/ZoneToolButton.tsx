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
import { ZONE_SHAPE_OPTIONS } from "../toolbarItems";

type ZoneToolButtonProps = {
  activeToolId: ToolId;
  menuOpen: boolean;
  onCloseBackgroundMenu: () => void;
  setMenuOpen: (isOpen: boolean | ((isOpen: boolean) => boolean)) => void;
  tool: ToolDefinition;
  zoneShapeMode: ZoneShape;
};

export function ZoneToolButton({
  activeToolId,
  menuOpen,
  onCloseBackgroundMenu,
  setMenuOpen,
  tool,
  zoneShapeMode
}: ZoneToolButtonProps) {
  const dispatch = useDispatch();
  const selected = activeToolId === "zone";

  return (
    <div className="relative">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-pressed={selected}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
          selected
            ? "border-canvas-ink bg-canvas-ink text-white"
            : "border-canvas-line bg-white text-canvas-ink"
        }`}
        onClick={() => {
          dispatch(setActiveTool("zone"));
          onCloseBackgroundMenu();
          setMenuOpen((isMenuOpen) => !isMenuOpen);
        }}
        title={tool.tooltip}
        type="button"
      >
        {tool.label}
      </button>
      {menuOpen ? (
        <div
          aria-label="Zone shape options"
          className="absolute left-0 top-full z-10 mt-2 rounded-2xl border border-canvas-line bg-canvas-panel p-2 shadow-lg"
          role="radiogroup"
        >
          <div className="flex gap-2">
            {ZONE_SHAPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const optionSelected = zoneShapeMode === option.shape;

              return (
                <button
                  key={option.shape}
                  aria-checked={optionSelected}
                  aria-label={`${option.label} zone shape`}
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                    optionSelected
                      ? "border-canvas-ink bg-canvas-ink text-white"
                      : "border-canvas-line bg-white text-canvas-ink hover:bg-canvas"
                  }`}
                  onClick={() => {
                    dispatch(setActiveTool("zone"));
                    dispatch(setZoneShapeMode(option.shape));
                    setMenuOpen(false);
                  }}
                  role="radio"
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-1 right-1 text-[10px] ${
                      optionSelected ? "text-white/60" : "text-canvas-muted/70"
                    }`}
                  >
                    {option.keybind}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
