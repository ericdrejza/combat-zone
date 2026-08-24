import {
  Expand,
  Image,
  ImagePlus,
  Link2,
  Minimize2,
  MoveHorizontal,
  MoveVertical,
  RefreshCw,
  Shrink,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { useDispatch } from "react-redux";

import type { EncounterState } from "@core/encounter/types";
import { setActiveTool } from "@interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "@interaction/tools/toolRegistry";
import { WebImageUrlDialog } from "@ui/library/WebImageUrlDialog";
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
  const [webImageDialogOpen, setWebImageDialogOpen] = useState(false);
  const backgroundImage = encounter.backgroundImage;
  const {
    activeFitMode,
    addBackgroundFromUrl,
    deleteBackground,
    fileInputRef,
    handleBackgroundFileChange,
    requestBackgroundUpload,
    resizeBackground,
    scaleBackground
  } = useBackgroundTool(encounter);
  const selected = activeToolId === "background";

  return (
    <ToolbarOptionRow aria-label="Background options">
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
        <>
          {!backgroundImage ? (
            <ToolbarOptionGroup>
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
              <ToolbarOptionButton
                aria-label="Add background from web"
                className="w-8 min-w-0 px-0"
                onClick={() => setWebImageDialogOpen(true)}
                role="menuitem"
                title="Add from web"
                type="button"
              >
                <Link2 aria-hidden="true" className="h-4 w-4" />
              </ToolbarOptionButton>
            </ToolbarOptionGroup>
          ) : (
            <ToolbarOptionGroup>
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
                aria-label="Replace background from web"
                className="w-8 min-w-0 px-0"
                onClick={() => setWebImageDialogOpen(true)}
                role="menuitem"
                title="Replace from web"
                type="button"
              >
                <Link2 aria-hidden="true" className="h-4 w-4" />
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
            </ToolbarOptionGroup>
          )}
          <ToolbarOptionGroup
            aria-label="Background size"
            role="radiogroup"
          >
            <ToolbarOptionButton
              active={activeFitMode === "fit"}
              aria-checked={activeFitMode === "fit"}
              aria-label="Fit"
              onClick={() => resizeBackground("fit")}
              role="radio"
              title="Fit"
              type="button"
            >
              <Minimize2 aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
            <ToolbarOptionButton
              active={activeFitMode === "fit-width"}
              aria-checked={activeFitMode === "fit-width"}
              aria-label="Fit width"
              onClick={() => resizeBackground("fit-width")}
              role="radio"
              title="Fit width"
              type="button"
            >
              <MoveHorizontal aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
            <ToolbarOptionButton
              active={activeFitMode === "fit-height"}
              aria-checked={activeFitMode === "fit-height"}
              aria-label="Fit height"
              onClick={() => resizeBackground("fit-height")}
              role="radio"
              title="Fit height"
              type="button"
            >
              <MoveVertical aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
          </ToolbarOptionGroup>
          <ToolbarOptionGroup aria-label="Background scale">
            <ToolbarOptionButton
              aria-label="Shrink"
              onClick={() => scaleBackground(0.9)}
              title="Shrink"
              type="button"
            >
              <Shrink aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
            <ToolbarOptionButton
              aria-label="Expand"
              onClick={() => scaleBackground(1.1)}
              title="Expand"
              type="button"
            >
              <Expand aria-hidden="true" className="h-4 w-4" />
            </ToolbarOptionButton>
          </ToolbarOptionGroup>
        </>
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
      {webImageDialogOpen ? (
        <WebImageUrlDialog
          description="The encounter will keep a reference to this URL; the image file will not be copied into the encounter."
          onClose={() => setWebImageDialogOpen(false)}
          onSubmit={async (url) => {
            await addBackgroundFromUrl(url);
            setWebImageDialogOpen(false);
          }}
          title={
            backgroundImage
              ? "Replace background from web"
              : "Add background from web"
          }
        />
      ) : null}
    </ToolbarOptionRow>
  );
}
