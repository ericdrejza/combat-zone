import {
  ChevronLeft,
  Folder,
  Grid2X2,
  List
} from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActorDragImage } from "@core/rendering/actorDragPreview";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { readImageAssetDimensions } from "@ui/toolbar/background/readImageFile";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/validatedEncounterChange";
import { createActor } from "@entities/actor/actorMutations";
import { clearSelection } from "@interaction/interactionState";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode, LibrarySectionId } from "@library/types";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { commitEncounterChange } from "@store/encounterSlice";
import { logEncounterValidationBlock } from "@store/encounterLogSlice";
import type { RootState } from "@store/store";
import { LIBRARY_NODE_DRAG_TYPE } from "../library/libraryDrag";
import { getFoldersFirstChildren } from "../library/libraryUi";
import { LibraryPanelNode } from "./LibraryPanelNode";
import { commitBackgroundImage } from "@ui/toolbar/background/backgroundCanvasActions";
import { useCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import { armCompactCanvasTransfer } from "@ui/canvas/compactCanvasTransfer";
import { useOptionalCloudSync } from "@ui/cloud_sync";

function getPanelSectionId(activeToolId: ToolId): LibrarySectionId | null {
  if (activeToolId === "actor") {
    return "tokens";
  }

  if (activeToolId === "background") {
    return "backgrounds";
  }

  return null;
}

export type LibraryViewMode = "list" | "grid";

export type LibraryPanelFocusRequest = {
  folderId: string;
  nodeId: string;
  sectionId: LibrarySectionId;
};

type LibraryPanelProps = {
  focusRequest?: LibraryPanelFocusRequest | null;
  onFocusRequestHandled?: () => void;
  viewMode: LibraryViewMode;
};

type LibraryPanelViewToggleProps = {
  onToggle: () => void;
  viewMode: LibraryViewMode;
};

/** Keeps the library layout preference next to the library-specific panel UI. */
export function LibraryPanelViewToggle({
  onToggle,
  viewMode
}: LibraryPanelViewToggleProps) {
  const showingGrid = viewMode === "grid";

  return (
    <button
      aria-label={
        showingGrid
          ? "Switch Library to list view"
          : "Switch Library to grid view"
      }
      aria-pressed={showingGrid}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas"
      onClick={onToggle}
      type="button"
    >
      {showingGrid ? (
        <List aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Grid2X2 aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

export function LibraryPanel({
  focusRequest,
  onFocusRequestHandled,
  viewMode
}: LibraryPanelProps) {
  const dispatch = useDispatch();
  const cloud = useOptionalCloudSync();
  const { getViewportSize, zoom: viewportZoom } = useCanvasViewport();
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
  const assetButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    return () => dragPreviewCleanupRef.current?.();
  }, []);

  useEffect(() => {
    if (!focusRequest || focusRequest.sectionId !== sectionId) {
      return;
    }

    setCurrentFolderBySection((current) => ({
      ...current,
      [focusRequest.sectionId]: focusRequest.folderId
    }));
  }, [focusRequest, sectionId]);

  useEffect(() => {
    if (
      !focusRequest ||
      focusRequest.sectionId !== sectionId ||
      currentFolderBySection[focusRequest.sectionId] !== focusRequest.folderId
    ) {
      return;
    }

    const button = assetButtonRefs.current[focusRequest.nodeId];

    if (!button) {
      return;
    }

    button.scrollIntoView?.({ block: "nearest" });
    button.focus();
    onFocusRequestHandled?.();
  }, [
    currentFolderBySection,
    focusRequest,
    onFocusRequestHandled,
    sectionId
  ]);

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

    const commitImage = (backgroundImage: Awaited<ReturnType<typeof readImageAssetDimensions>>) =>
      commitBackgroundImage({
        backgroundImage: { ...backgroundImage, libraryNodeId: node.id },
        dispatch,
        encounter,
        viewportSize: getViewportSize(),
        viewportZoom
      });

    if (asset.width && asset.height) {
      commitImage({ ...asset, height: asset.height, width: asset.width });
    } else {
      void readImageAssetDimensions(asset, cloud?.resolveImageAsset).then(commitImage);
    }
  }

  function startLibraryDrag(
    event: DragEvent<HTMLElement>,
    node: LibraryNode,
    imageUrl: string | null
  ) {
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
      image: asset.source,
      imageUrl,
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
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action,
      currentEncounter: encounter,
      nextEncounter
    });

    const commitPrepared = (resolved: Awaited<typeof prepared>) => {
      if (resolved.blocked) {
        logEncounterValidationBlock(dispatch, resolved);
        return;
      }

      dispatch(
        commitEncounterChange({
          action: resolved.action,
          nextEncounter: resolved.nextEncounter
        })
      );
    };

    if (prepared instanceof Promise) {
      void prepared.then(commitPrepared);
    } else {
      commitPrepared(prepared);
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
      <div
        className={
          viewMode === "grid" ? "grid grid-cols-2 gap-2" : "space-y-2"
        }
      >
        {children.map((node) => {
          return (
            <LibraryPanelNode
              key={node.id}
              asset={resolveLibraryAsset(section, node.id)}
              buttonRef={(button) => {
                assetButtonRefs.current[node.id] = button;
              }}
              isBackground={activeSectionId === "backgrounds"}
              isToken={activeSectionId === "tokens"}
              node={node}
              onClick={() =>
                activeSectionId === "backgrounds"
                  ? applyBackground(node)
                  : void createActorInTargetZone(node)
              }
              onDragEnd={finishLibraryDrag}
              onDragStart={(event, imageUrl) =>
                startLibraryDrag(event, node, imageUrl)
              }
              onNavigate={() => navigateTo(node.id)}
              onPointerDown={(event) => {
                if (activeSectionId === "tokens" && node.type !== "folder") {
                  armCompactCanvasTransfer(event.nativeEvent, {
                    kind: "library-node",
                    nodeId: node.id
                  }, undefined, "all");
                }
              }}
              viewMode={viewMode}
            />
          );
        })}
      </div>
    </div>
  );
}
