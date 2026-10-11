import { resolveLibraryGridCardSize } from "@ui/interface_preferences/libraryPreferences";
import { ChevronLeft, Folder } from "lucide-react";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setActorDragImage } from "@core/rendering/actorDragPreview";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { readImageAssetDimensions } from "@ui/toolbar/background/readImageFile";
import { prepareValidatedEncounterChangeForRuntime } from "@core/validation/runtimeEncounterChange";
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
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { libraryGridStyle } from "@ui/library/libraryGridStyle";
import { useAudioCueAssignment } from "@ui/audio/useAudioCueAssignment";

function getPanelSectionId(activeToolId: ToolId): LibrarySectionId | null {
  if (activeToolId === "actor") {
    return "tokens";
  }

  if (activeToolId === "background") {
    return "backgrounds";
  }

  if (activeToolId === "audio") return "audio";

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

export { LibraryPanelHeaderActions, LibraryPanelViewToggle } from "./LibraryPanelHeaderActions";

export function LibraryPanel({
  focusRequest,
  onFocusRequestHandled,
  viewMode
}: LibraryPanelProps) {
  const preferences = useInterfacePreferences();
  const dispatch = useDispatch();
  const cloud = useOptionalCloudSync();
  const audioAssignment = useAudioCueAssignment();
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
        Actor, Background, or Audio tools show library assets here.
      </p>
    );
  }

  const activeSectionId = sectionId;
  const libraryGridCardSize = resolveLibraryGridCardSize(preferences, activeSectionId);
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
    imageUrl: string | null,
    mediaType?: string
  ) {
    if ((activeSectionId !== "tokens" && activeSectionId !== "audio") || node.type === "folder") {
      return;
    }

    const asset = resolveLibraryAsset(section, node.id);

    if (!asset) {
      return;
    }

    if (activeSectionId === "tokens") dispatch(clearSelection());
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(LIBRARY_NODE_DRAG_TYPE, node.id);
    event.dataTransfer.setData("text/plain", node.id);
    if (activeSectionId !== "tokens") return;
    dragPreviewCleanupRef.current?.();
    dragPreviewCleanupRef.current = setActorDragImage(event.dataTransfer, {
      image: asset.source,
      imageUrl,
      layoutGroup: actorTool.layoutGroup,
      mediaType: mediaType ?? asset.mediaType,
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
      // Keep the selected node's identity, including when it is a Library link.
      // The resolved asset alone does not retain provenance for the actor inspector.
      image: { ...asset, libraryNodeId: node.id },
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

  function createAudioCueForTarget(node: LibraryNode) {
    if (activeSectionId === "audio") audioAssignment.requestDestination(node);
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
          viewMode === "grid" ? "grid gap-2" : "space-y-2"
        }
        style={viewMode === "grid" ? libraryGridStyle(libraryGridCardSize) : undefined}
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
              isAudio={activeSectionId === "audio"}
              isToken={activeSectionId === "tokens"}
              node={node}
              onClick={() =>
                activeSectionId === "backgrounds"
                  ? applyBackground(node)
                  : activeSectionId === "tokens"
                    ? void createActorInTargetZone(node)
                    : undefined
              }
              onDoubleClick={() => createAudioCueForTarget(node)}
              onDragEnd={finishLibraryDrag}
              onDragStart={(event, imageUrl) =>
                startLibraryDrag(
                  event,
                  node,
                  imageUrl,
                  resolveLibraryAsset(section, node.id)?.mediaType
                )
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
      {audioAssignment.dialog}
    </div>
  );
}
