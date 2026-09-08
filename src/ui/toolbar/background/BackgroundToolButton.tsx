import {
  Expand,
  BookOpen,
  Image,
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
import { createPortal } from "react-dom";

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
  ToolbarOptionRow,
  ToolbarSubtoolBar
} from "../ToolbarOption";
import { TOOL_ICONS } from "../toolbarItems";
import { TouchTooltip } from "../TouchTooltip";
import { useBackgroundTool } from "./useBackgroundTool";

type BackgroundToolButtonProps = {
  activeToolId: ToolId;
  compactLayout: boolean;
  compactSubtoolHost: HTMLDivElement | null;
  encounter: EncounterState;
  onOpenLibrary: () => void;
  tool: ToolDefinition;
};

export function BackgroundToolButton({
  activeToolId,
  compactLayout,
  compactSubtoolHost,
  encounter,
  onOpenLibrary,
  tool
}: BackgroundToolButtonProps) {
  const dispatch = useDispatch();
  const [webImageDialogOpen, setWebImageDialogOpen] = useState(false);
  const backgroundImage = encounter.backgroundImage;
  const {
    activeFitMode,
    addBackgroundFromUrl,
    deleteBackground,
    resizeBackground,
    scaleBackground
  } = useBackgroundTool(encounter);
  const selected = activeToolId === "background";
  const optionBar = selected ? (
    <ToolbarSubtoolBar aria-label="Background options">
      {renderOptions()}
      {renderSizingOptions()}
    </ToolbarSubtoolBar>
  ) : null;

  function renderOptions() {
    if (!backgroundImage) {
      return (
        <ToolbarOptionGroup>
          <ToolbarOptionButton
            aria-label="Add background from library"
            className="w-11 min-w-0 px-0 lg:w-8"
            onClick={onOpenLibrary}
            role="menuitem"
            title="Add background from library"
            type="button"
          >
            <BookOpen aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
          <ToolbarOptionButton
            aria-label="Add background from web"
            className="w-11 min-w-0 px-0 lg:w-8"
            onClick={() => setWebImageDialogOpen(true)}
            role="menuitem"
            title="Add from web"
            type="button"
          >
            <Link2 aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </ToolbarOptionGroup>
      );
    }

    return (
      <>
        <ToolbarOptionGroup>
          <ToolbarOptionButton
            aria-label="Replace with library asset"
            className="w-11 min-w-0 px-0 lg:w-8"
            onClick={onOpenLibrary}
            role="menuitem"
            title="Replace with library asset"
            type="button"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
          <ToolbarOptionButton
            aria-label="Replace background from web"
            className="w-11 min-w-0 px-0 lg:w-8"
            onClick={() => setWebImageDialogOpen(true)}
            role="menuitem"
            title="Replace from web"
            type="button"
          >
            <Link2 aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
          <ToolbarOptionButton
            aria-label="Delete"
            className="w-11 min-w-0 px-0 text-red-700 hover:bg-red-50 lg:w-8"
            onClick={deleteBackground}
            role="menuitem"
            title="Delete"
            type="button"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </ToolbarOptionButton>
        </ToolbarOptionGroup>
      </>
    );
  }

  function renderSizingOptions() {
    return (
      <>
        <ToolbarOptionGroup aria-label="Background size" role="radiogroup">
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
    );
  }

  return (
    <>
      <ToolbarOptionRow aria-label="Background options" className="max-lg:contents">
        <TouchTooltip label={tool.tooltip}>
          <button
            aria-expanded={selected}
            aria-haspopup="menu"
            aria-label={tool.label}
            aria-pressed={selected}
            className={`flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-2 text-sm font-medium shadow-sm transition hover:bg-canvas lg:h-auto lg:min-w-0 lg:px-3 lg:py-1.5 ${
              selected
                ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink"
                : "border-canvas-line bg-canvas-surface text-canvas-ink"
            }`}
            onClick={() => {
              dispatch(setActiveTool("background"));
            }}
            title={tool.tooltip}
            type="button"
          >
            <Image aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="hidden lg:inline">{tool.label}</span>
          </button>
        </TouchTooltip>
        {!compactLayout ? optionBar : null}
      </ToolbarOptionRow>
      {compactLayout && compactSubtoolHost && optionBar
        ? createPortal(optionBar, compactSubtoolHost)
        : null}
      {webImageDialogOpen ? (
        <WebImageUrlDialog
          description="The encounter will keep a reference to this URL; the image file will not be copied into the encounter."
          onClose={() => setWebImageDialogOpen(false)}
          onSubmit={async (url, name) => {
            await addBackgroundFromUrl(url, name);
            setWebImageDialogOpen(false);
          }}
          title={
            backgroundImage
              ? "Replace background from web"
              : "Add background from web"
          }
        />
      ) : null}
    </>
  );
}
