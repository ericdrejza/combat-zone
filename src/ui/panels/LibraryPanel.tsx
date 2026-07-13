import { ChevronLeft, FileImage, Folder, Link } from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActorDragImage } from "../../core/rendering/actorDragPreview";
import { createEncounterActionRecord } from "../../core/history/createEncounterActionRecord";
import { prepareValidatedEncounterChange } from "../../core/validation/validatedEncounterChange";
import { createActor } from "../../entities/actor/actorMutations";
import { clearSelection } from "../../interaction/interactionState";
import { resolveLibraryAsset } from "../../library/librarySlice";
import type { LibraryNode, LibrarySectionId } from "../../library/types";
import type { ToolId } from "../../interaction/tools/toolRegistry";
import { commitEncounterChange } from "../../store/encounterSlice";
import type { RootState } from "../../store/store";
import { LIBRARY_NODE_DRAG_TYPE } from "../library/libraryDrag";
import { getFoldersFirstChildren } from "../library/libraryUi";

function getPanelSectionId(activeToolId: ToolId): LibrarySectionId | null {
  if (activeToolId === "actor") {
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
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const dragPreviewCleanupRef = useRef<(() => void) | null>(null);
  const sectionId = getPanelSectionId(activeToolId);
  const [currentFolderBySection, setCurrentFolderBySection] = useState<
    Partial<Record<LibrarySectionId, string>>
  >({});

  useEffect(() => {
    return () => dragPreviewCleanupRef.current?.();
  }, []);

  if (!sectionId) {
    return (
      <p className="text-sm text-canvas-muted">
        Actor or Background tools show library assets here.
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

  function startLibraryDrag(event: DragEvent<HTMLElement>, node: LibraryNode) {
    if (activeSectionId !== "tokens" || node.type === "folder") {
      return;
    }

    const asset = resolveLibraryAsset(section, node.id);

    if (!asset) {
      return;
    }

    dispatch(clearSelection());
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(LIBRARY_NODE_DRAG_TYPE, node.id);
    event.dataTransfer.setData("text/plain", node.id);
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = setActorDragImage(event.dataTransfer, {
      image: asset.dataUrl,
      layoutGroup: actorTool.layoutGroup,
      name: node.name,
      shape: actorTool.shape,
      size: actorTool.size
    });
  }

  function finishLibraryDrag() {
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = null;
  }

  function createActorInTargetZone(node: LibraryNode) {
    if (activeSectionId !== "tokens" || !actorTool.targetZoneId) {
      return;
    }

    const asset = resolveLibraryAsset(section, node.id);

    if (!asset) {
      return;
    }

    const actorId = `actor-${Date.now()}`;
    const nextEncounter = createActor(encounter, {
      currentZoneId: actorTool.targetZoneId,
      id: actorId,
      image: asset,
      layoutGroup: actorTool.layoutGroup,
      shape: actorTool.shape,
      size: actorTool.size
    });
    const action = createEncounterActionRecord("actor.create", {
      actorId,
      destinationZoneId: actorTool.targetZoneId
    });
    const prepared = prepareValidatedEncounterChange({
      action,
      currentEncounter: encounter,
      nextEncounter
    });

    if (!prepared.blocked) {
      dispatch(
        commitEncounterChange({
          action: prepared.action,
          nextEncounter: prepared.nextEncounter
        })
      );
    }
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
        const isToken = activeSectionId === "tokens";

        return (
          <button
            key={node.id}
            className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-canvas ${
              isBackground || isToken ? "cursor-pointer" : "cursor-default"
            }`}
            draggable={isToken}
            onClick={() =>
              isBackground ? applyBackground(node) : createActorInTargetZone(node)
            }
            onDragStart={(event) => startLibraryDrag(event, node)}
            onDragEnd={finishLibraryDrag}
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
