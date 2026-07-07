import { Image, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";

import type { EncounterState } from "../../../core/encounter/types";
import { setActiveTool } from "../../../interaction/interactionState";
import type {
  ToolDefinition,
  ToolId
} from "../../../interaction/tools/toolRegistry";
import { useBackgroundTool } from "./useBackgroundTool";

type BackgroundToolButtonProps = {
  activeToolId: ToolId;
  encounter: EncounterState;
  menuOpen: boolean;
  onCloseZoneMenu: () => void;
  setMenuOpen: (isOpen: boolean | ((isOpen: boolean) => boolean)) => void;
  tool: ToolDefinition;
};

export function BackgroundToolButton({
  activeToolId,
  encounter,
  menuOpen,
  onCloseZoneMenu,
  setMenuOpen,
  tool
}: BackgroundToolButtonProps) {
  const dispatch = useDispatch();
  const backgroundImage = encounter.backgroundImage;
  const {
    deleteBackground,
    fileInputRef,
    handleBackgroundFileChange,
    requestBackgroundUpload
  } = useBackgroundTool(encounter, (isOpen) => setMenuOpen(isOpen));
  const selected = activeToolId === "background";

  return (
    <div className="relative">
      <button
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-pressed={selected}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
          selected
            ? "border-canvas-ink bg-canvas-ink text-white"
            : "border-canvas-line bg-white text-canvas-ink"
        }`}
        onClick={() => {
          dispatch(setActiveTool("background"));
          setMenuOpen((isMenuOpen) => !isMenuOpen);
          onCloseZoneMenu();
        }}
        title={tool.tooltip}
        type="button"
      >
        <Image aria-hidden="true" className="h-4 w-4" />
        {tool.label}
      </button>
      {menuOpen ? (
        <div
          aria-label="Background options"
          className="absolute left-0 top-full z-10 mt-2 min-w-36 rounded-2xl border border-canvas-line bg-canvas-panel p-2 shadow-lg"
          role="menu"
        >
          {!backgroundImage ? (
            <button
              className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas"
              onClick={() => requestBackgroundUpload("add")}
              role="menuitem"
              type="button"
            >
              Add
            </button>
          ) : (
            <>
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas"
                onClick={() => requestBackgroundUpload("replace")}
                role="menuitem"
                type="button"
              >
                Replace
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
                onClick={deleteBackground}
                role="menuitem"
                type="button"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
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
    </div>
  );
}
