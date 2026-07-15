import { Image, ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { setActiveTool } from "@interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "@interaction/tools/toolRegistry";
import {
  ToolbarOptionButton,
  ToolbarOptionGroup,
  ToolbarOptionRow
} from "../ToolbarOption";
import { useBackgroundTool } from "./useBackgroundTool";

type BackgroundToolButtonProps = {
  activeToolId: ToolId;
  encounter: EncounterState;
  tool: ToolDefinition;
};

export function BackgroundToolButton({
  activeToolId,
  encounter,
  tool
}: BackgroundToolButtonProps) {
  const dispatch = useDispatch();
  const backgroundImage = encounter.backgroundImage;
  const {
    deleteBackground,
    fileInputRef,
    handleBackgroundFileChange,
    requestBackgroundUpload
  } = useBackgroundTool(encounter);
  const selected = activeToolId === "background";

  return (
    <ToolbarOptionRow>
      <button
        aria-expanded={selected}
        aria-haspopup="menu"
        aria-pressed={selected}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
          selected
            ? "border-canvas-ink bg-canvas-ink text-white"
            : "border-canvas-line bg-white text-canvas-ink"
        }`}
        onClick={() => {
          dispatch(setActiveTool("background"));
        }}
        title={tool.tooltip}
        type="button"
      >
        <Image aria-hidden="true" className="h-4 w-4" />
        {tool.label}
      </button>
      {selected ? (
        <ToolbarOptionGroup
          aria-label="Background options"
          role="menu"
        >
          {!backgroundImage ? (
            <ToolbarOptionButton
              aria-label="Add"
              className="w-8 min-w-0 px-0"
              onClick={() => requestBackgroundUpload("add")}
              role="menuitem"
              title="Add"
              type="button"
            >
              <ImagePlus aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
          ) : (
            <>
              <ToolbarOptionButton
                aria-label="Replace"
                className="w-8 min-w-0 px-0"
                onClick={() => requestBackgroundUpload("replace")}
                role="menuitem"
                title="Replace"
                type="button"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
              </ToolbarOptionButton>
              <ToolbarOptionButton
                aria-label="Delete"
                className="w-8 min-w-0 px-0 text-red-700 hover:bg-red-50"
                onClick={deleteBackground}
                role="menuitem"
                title="Delete"
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </ToolbarOptionButton>
            </>
          )}
        </ToolbarOptionGroup>
      ) : null}
      <input
        ref={fileInputRef}
        accept="image/*"
        aria-label="Upload background image"
        className="sr-only"
        onChange={(event) => {
          void handleBackgroundFileChange(event);
        }}
        type="file"
      />
    </ToolbarOptionRow>
  );
}
