import { Circle, Hexagon, Image, Pentagon, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterBackgroundImage } from "../../core/encounter/types";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import {
  setActiveTool,
  setZoneShapeMode
} from "../../interaction/interactionState";
import {
  TOOL_DEFINITIONS_BY_ID
} from "../../interaction/tools/toolRegistry";
import type { ToolDefinition } from "../../interaction/tools/toolRegistry";
import type { ZoneShape } from "../../entities/zone/types";
import type { RootState } from "../../store/store";
import { commitEncounterChange } from "../../store/encounterSlice";
import { CLOSE_ZONE_SHAPE_MENU_EVENT } from "./events";

type BackgroundAction = "add" | "replace";
type ZoneShapeOption = {
  icon: typeof Square;
  keybind: string;
  label: string;
  shape: ZoneShape;
};
type ToolbarItem =
  | {
      type: "tool";
      tool: ToolDefinition;
    }
  | {
      id: string;
      type: "separator";
    };

const TOOLBAR_ITEMS: ToolbarItem[] = [
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.background },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.zone },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.edge },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.annotation },
  { id: "annotation-actor", type: "separator" },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.actor },
  { id: "actor-select", type: "separator" },
  { type: "tool", tool: TOOL_DEFINITIONS_BY_ID.select }
];

const ZONE_SHAPE_OPTIONS: ZoneShapeOption[] = [
  { icon: Square, keybind: "1", label: "Rectangle", shape: "rectangle" },
  { icon: Circle, keybind: "2", label: "Circle", shape: "circle" },
  { icon: Hexagon, keybind: "3", label: "Hexagon", shape: "hexagon" },
  { icon: Pentagon, keybind: "4", label: "Polygon", shape: "polygon" }
];

function readImageFile(file: File): Promise<EncounterBackgroundImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Selected file could not be read as an image."));
        return;
      }

      resolve({
        dataUrl: reader.result,
        mediaType: file.type || "application/octet-stream",
        name: file.name
      });
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Selected file could not be read."));
    });
    reader.readAsDataURL(file);
  });
}

export function Toolbar() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const backgroundImage = encounter.backgroundImage;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);
  const [pendingBackgroundAction, setPendingBackgroundAction] =
    useState<BackgroundAction>("add");

  useEffect(() => {
    function closeZoneMenu() {
      setZoneMenuOpen(false);
    }

    window.addEventListener(CLOSE_ZONE_SHAPE_MENU_EVENT, closeZoneMenu);

    return () => {
      window.removeEventListener(CLOSE_ZONE_SHAPE_MENU_EVENT, closeZoneMenu);
    };
  }, []);

  function requestBackgroundUpload(action: BackgroundAction) {
    setPendingBackgroundAction(action);
    setBackgroundMenuOpen(false);
    fileInputRef.current?.click();
  }

  async function handleBackgroundFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    const nextBackgroundImage = await readImageFile(file);
    const actionType =
      pendingBackgroundAction === "replace"
        ? "background.replace"
        : "background.add";

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord(actionType, {
          backgroundImage: nextBackgroundImage
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: nextBackgroundImage
        }
      })
    );
    dispatch(setActiveTool("zone"));
  }

  function deleteBackground() {
    setBackgroundMenuOpen(false);

    if (!backgroundImage) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createEncounterActionRecord("background.delete", {
          backgroundImageName: backgroundImage.name
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: null
        }
      })
    );
  }

  function renderToolButton(tool: ToolDefinition) {
    if (tool.id === "background") {
      return (
        <div key={tool.id} className="relative">
          <button
            aria-expanded={backgroundMenuOpen}
            aria-haspopup="menu"
            aria-pressed={activeToolId === "background"}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
              activeToolId === "background"
                ? "border-canvas-ink bg-canvas-ink text-white"
                : "border-canvas-line bg-white text-canvas-ink"
            }`}
            onClick={() => {
              dispatch(setActiveTool("background"));
              setBackgroundMenuOpen((isMenuOpen) => !isMenuOpen);
              setZoneMenuOpen(false);
            }}
            title={tool.tooltip}
            type="button"
          >
            <Image aria-hidden="true" className="h-4 w-4" />
            {tool.label}
          </button>
          {backgroundMenuOpen ? (
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

    if (tool.id === "zone") {
      return (
        <div key={tool.id} className="relative">
          <button
            aria-expanded={zoneMenuOpen}
            aria-haspopup="true"
            aria-pressed={activeToolId === "zone"}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
              activeToolId === "zone"
                ? "border-canvas-ink bg-canvas-ink text-white"
                : "border-canvas-line bg-white text-canvas-ink"
            }`}
            onClick={() => {
              dispatch(setActiveTool("zone"));
              setBackgroundMenuOpen(false);
              setZoneMenuOpen((isMenuOpen) => !isMenuOpen);
            }}
            title={tool.tooltip}
            type="button"
          >
            {tool.label}
          </button>
          {zoneMenuOpen ? (
            <div
              aria-label="Zone shape options"
              className="absolute left-0 top-full z-10 mt-2 rounded-2xl border border-canvas-line bg-canvas-panel p-2 shadow-lg"
              role="radiogroup"
            >
              <div className="flex gap-2">
                {ZONE_SHAPE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = zoneShapeMode === option.shape;

                  return (
                    <button
                      key={option.shape}
                      aria-checked={selected}
                      aria-label={`${option.label} zone shape`}
                      className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                        selected
                          ? "border-canvas-ink bg-canvas-ink text-white"
                          : "border-canvas-line bg-white text-canvas-ink hover:bg-canvas"
                      }`}
                      onClick={() => {
                        dispatch(setActiveTool("zone"));
                        dispatch(setZoneShapeMode(option.shape));
                        setZoneMenuOpen(false);
                      }}
                      role="radio"
                      type="button"
                    >
                      <Icon aria-hidden="true" className="h-5 w-5" />
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-1 right-1 text-[10px] ${
                          selected ? "text-white/60" : "text-canvas-muted/70"
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

    return (
      <button
        key={tool.id}
        aria-pressed={activeToolId === tool.id}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-canvas ${
          activeToolId === tool.id
            ? "border-canvas-ink bg-canvas-ink text-white"
            : "border-canvas-line bg-white text-canvas-ink"
        }`}
        onClick={() => {
          dispatch(setActiveTool(tool.id));
          setBackgroundMenuOpen(false);
          setZoneMenuOpen(false);
        }}
        title={tool.tooltip}
        type="button"
      >
        {tool.label}
      </button>
    );
  }

  return (
    <header
      aria-label="Combat Zone toolbar"
      className="border-b border-canvas-line bg-canvas-panel px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 font-display text-2xl font-semibold tracking-tight">
          Combat Zone
        </h1>
        <nav aria-label="Tools" className="flex flex-wrap gap-2">
          {TOOLBAR_ITEMS.map((item) =>
            item.type === "separator" ? (
              <span
                key={item.id}
                aria-orientation="vertical"
                className="mx-1 h-8 w-px self-center bg-canvas-line"
                role="separator"
              />
            ) : (
              renderToolButton(item.tool)
            )
          )}
        </nav>
      </div>
    </header>
  );
}
