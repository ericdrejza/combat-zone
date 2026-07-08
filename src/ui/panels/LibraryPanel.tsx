import { ChevronLeft, FileImage, Folder, Link } from "lucide-react";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { resolveLibraryAsset } from "../../library/librarySlice";
import type { LibraryNode, LibrarySectionId } from "../../library/types";
import type { ToolId } from "../../interaction/tools/toolRegistry";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";
import { getFoldersFirstChildren } from "../library/libraryUi";

function getPanelSectionId(activeToolId: ToolId): LibrarySectionId | null {
  if (activeToolId === "select") {
    return "tokens";
  }

  if (activeToolId === "background") {
    return "backgrounds";
  }

  return null;
}

export function LibraryPanel() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const sectionId = getPanelSectionId(activeToolId);
  const [currentFolderBySection, setCurrentFolderBySection] = useState<
    Partial<Record<LibrarySectionId, string>>
  >({});

  if (!sectionId) {
    return (
      <p className="text-sm text-canvas-muted">
        Select or Background tools show library assets here.
      </p>
    );
  }

  const activeSectionId = sectionId;
  const section = library.sections[activeSectionId];
  const currentFolderId = (
    currentFolderBySection[activeSectionId] &&
    section.nodesById[currentFolderBySection[activeSectionId]]
      ? currentFolderBySection[activeSectionId]
      : section.rootId
  ) as string;
  const currentFolder = section.nodesById[currentFolderId];
  const children = getFoldersFirstChildren(section, currentFolderId);

  function navigateTo(folderId: string) {
    setCurrentFolderBySection((current) => ({
      ...current,
      [activeSectionId]: folderId
    }));
  }

  function applyBackground(node: LibraryNode) {
    const asset = resolveLibraryAsset(section, node.id);

    if (!asset || activeSectionId !== "backgrounds") {
      return;
    }

    dispatch(commitEncounterChange({
      action: createEncounterActionRecord(
        encounter.backgroundImage ? "background.replace" : "background.add",
        {
          backgroundImage: asset
        }
      ),
      nextEncounter: {
        ...encounter,
        backgroundImage: asset
      }
    }));
  }

  return (
    <div className="space-y-2">
      <div
        aria-label="Current library folder"
        className="flex items-center gap-2 border-b border-canvas-line pb-2 text-sm font-semibold text-canvas-ink"
      >
        <Folder aria-hidden="true" className="h-4 w-4" />
        <span className="min-w-0 flex-1 truncate">{currentFolder.name}</span>
      </div>
      {currentFolder.parentId ? (
        <button
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-canvas"
          onClick={() => navigateTo(currentFolder.parentId as string)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {section.nodesById[currentFolder.parentId].name}
        </button>
      ) : null}
      {children.length === 0 ? (
        <p className="rounded-xl border border-dashed border-canvas-line px-3 py-4 text-sm text-canvas-muted">
          No {section.name.toLowerCase()} yet.
        </p>
      ) : null}
      {children.map((node) => {
        if (node.type === "folder") {
          return (
            <button
              key={node.id}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas"
              onClick={() => navigateTo(node.id)}
              type="button"
            >
              <Folder aria-hidden="true" className="h-4 w-4" />
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
            </button>
          );
        }

        const asset = resolveLibraryAsset(section, node.id);
        const isBackground = activeSectionId === "backgrounds";

        return (
          <button
            key={node.id}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas ${
              isBackground ? "cursor-pointer" : "cursor-default"
            }`}
            onClick={() => applyBackground(node)}
            type="button"
          >
            <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-lg border border-canvas-line bg-white">
              {asset ? (
                <img
                  alt=""
                  className="h-full w-full object-cover transition duration-150 ease-out group-hover:scale-[1.2]"
                  src={asset.dataUrl}
                />
              ) : node.type === "link" ? (
                <Link aria-hidden="true" className="h-4 w-4" />
              ) : (
                <FileImage aria-hidden="true" className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
          </button>
        );
      })}
    </div>
  );
}
