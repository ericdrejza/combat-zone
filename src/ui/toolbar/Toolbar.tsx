import { Image, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { EncounterBackgroundImage } from "../../core/encounter/types";
import type { EncounterActionRecord } from "../../core/history/types";
import { MVP_TOOLS } from "../../interaction/tools/toolRegistry";
import type { RootState } from "../../store/store";
import { commitEncounterChange } from "../../store/encounterSlice";

type BackgroundAction = "add" | "replace";

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

function createBackgroundActionRecord(
  type: string,
  payload: EncounterActionRecord["payload"]
): EncounterActionRecord {
  return {
    id: `background-${Date.now()}`,
    type,
    timestamp: Date.now(),
    payload,
    validationResult: {
      valid: true,
      messages: []
    }
  };
}

export function Toolbar() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const backgroundImage = encounter.backgroundImage;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [pendingBackgroundAction, setPendingBackgroundAction] =
    useState<BackgroundAction>("add");

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
        action: createBackgroundActionRecord(actionType, {
          backgroundImage: nextBackgroundImage
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: nextBackgroundImage
        }
      })
    );
  }

  function deleteBackground() {
    setBackgroundMenuOpen(false);

    if (!backgroundImage) {
      return;
    }

    dispatch(
      commitEncounterChange({
        action: createBackgroundActionRecord("background.delete", {
          backgroundImageName: backgroundImage.name
        }),
        nextEncounter: {
          ...encounter,
          backgroundImage: null
        }
      })
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
          <div className="relative">
            <button
              aria-expanded={backgroundMenuOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-2 rounded-full border border-canvas-line bg-white px-3 py-1.5 text-sm font-medium text-canvas-ink shadow-sm transition hover:bg-canvas"
              onClick={() =>
                setBackgroundMenuOpen((isMenuOpen) => !isMenuOpen)
              }
              title="Add, replace, or delete the canvas background image."
              type="button"
            >
              <Image aria-hidden="true" className="h-4 w-4" />
              Background
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
          {MVP_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className="rounded-full border border-canvas-line bg-white px-3 py-1.5 text-sm font-medium text-canvas-ink shadow-sm transition hover:bg-canvas"
              title={tool.tooltip}
              type="button"
            >
              {tool.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
