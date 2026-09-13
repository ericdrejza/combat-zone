import { Folder, FolderUp, Grid2X2, HardDrive, List, Play } from "lucide-react";
import { useTime, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";

import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode, LibrarySection } from "@library/types";
import { hasLeftDragSurface } from "./libraryDrag";
import { getAlphabetizedChildren } from "./libraryUi";
import { AssetLibraryContentNode } from "./AssetLibraryContentNode";
import { AssetLibraryEncounterItem } from "./AssetLibraryEncounterItem";
import { AssetLibraryPreview } from "./AssetLibraryPreview";
import type {
  AssetLibraryContextButtonState,
  AssetLibraryPreviewTarget,
  AssetLibraryViewMode
} from "./assetLibraryView";
import { DEFAULT_ASSET_LIBRARY_CONTEXT_BUTTON_STATE } from "./assetLibraryView";
import { useAssetLibraryPreview } from "./useAssetLibraryPreview";
import type { EncounterRecord } from "@core/persistence";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

type AssetLibraryContentsProps = {
  activeSection: LibrarySection;
  currentFolder: LibraryNode;
  draggedItemId?: string | null;
  dropFolderId: string | null;
  selectedNodeId: string | undefined;
  viewMode?: AssetLibraryViewMode;
  onViewModeChange?: (viewMode: AssetLibraryViewMode) => void;
  contextButtonState?: AssetLibraryContextButtonState;
  onContextButtonStateChange?: (state: AssetLibraryContextButtonState) => void;
  onDragOverContents: (event: DragEvent<HTMLElement>) => void;
  onDragOverFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onPointerDownNode: (
    event: ReactPointerEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onPointerDownEncounter?: (
    event: ReactPointerEvent<HTMLElement>,
    record: EncounterRecord
  ) => void;
  onOpenEncounterContextMenu?: (
    event: React.MouseEvent<HTMLElement>,
    record: EncounterRecord
  ) => void;
  onDropOnContents: (event: DragEvent<HTMLElement>) => void;
  onDropOnFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDoubleClickNode: (node: LibraryNode) => void;
  onEncounterFocused?: () => void;
  onNodeFocused?: () => void;
  onEnterFolder: (folderId: string) => void;
  onOpenContextMenu: (
    event: {
      clientX: number;
      clientY: number;
      preventDefault: () => void;
    },
    node: LibraryNode
  ) => void;
  onSelectNode: (nodeId: string) => void;
  setDropFolderId: (folderId: string | null) => void;
  encounterRecords?: EncounterRecord[];
  onLoadEncounter?: (id: string) => void;
  readOnly?: boolean;
  recentEncounterIds?: string[];
  focusedEncounterId?: string | null;
  focusedNodeId?: string | null;
  visibleNodeIds?: Set<string> | null;
};

export function AssetLibraryContents({
  activeSection,
  currentFolder,
  draggedItemId = null,
  dropFolderId,
  selectedNodeId,
  viewMode: controlledViewMode,
  onViewModeChange,
  contextButtonState: controlledContextButtonState,
  onContextButtonStateChange,
  onDragOverContents,
  onDragOverFolder,
  onPointerDownNode,
  onPointerDownEncounter,
  onOpenEncounterContextMenu,
  onDropOnContents,
  onDropOnFolder,
  onDoubleClickNode,
  onEncounterFocused,
  onNodeFocused,
  onEnterFolder,
  onOpenContextMenu,
  onSelectNode,
  setDropFolderId,
  encounterRecords = [],
  onLoadEncounter,
  readOnly = false,
  recentEncounterIds = [],
  focusedEncounterId = null,
  focusedNodeId = null,
  visibleNodeIds = null
}: AssetLibraryContentsProps) {
  const time = useTime();
  const encounterCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const libraryNodeCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [localViewMode, setLocalViewMode] =
    useState<AssetLibraryViewMode>("grid");
  const [localContextButtonState, setLocalContextButtonState] = useState(
    DEFAULT_ASSET_LIBRARY_CONTEXT_BUTTON_STATE
  );
  const contextButtonState =
    controlledContextButtonState ?? localContextButtonState;
  const { playAnimations, showAssetSizes } = contextButtonState;
  const { enableAssetAnimation } = useInterfacePreferences();
  const viewMode = controlledViewMode ?? localViewMode;

  function updateContextButtonState(
    update: Partial<AssetLibraryContextButtonState>
  ) {
    const nextState = { ...contextButtonState, ...update };
    onContextButtonStateChange?.(nextState);
    if (!controlledContextButtonState) setLocalContextButtonState(nextState);
  }
  const {
    beginPreviewInteraction,
    clearPreviewClearTimer,
    consumePreviewHold,
    endPreviewInteraction,
    largeHoverPreview,
    movePreviewInteraction,
    previewTarget,
    schedulePreviewClear
  } = useAssetLibraryPreview({
    resetKey: `${currentFolder.id}:${viewMode}`
  });
  const loadingRotation = useTransform(time, (milliseconds) =>
    `rotate(${(milliseconds / 1000) * 360}deg)`
  );

  useEffect(() => {
    if (!focusedEncounterId) {
      return;
    }

    const card = encounterCardRefs.current[focusedEncounterId];

    if (!card) {
      return;
    }

    card.scrollIntoView?.({ block: "nearest" });
    onEncounterFocused?.();
  }, [currentFolder.id, focusedEncounterId, encounterRecords, onEncounterFocused]);

  useEffect(() => {
    if (!focusedNodeId) {
      return;
    }

    const card = libraryNodeCardRefs.current[focusedNodeId];

    if (!card) {
      return;
    }

    card.scrollIntoView?.({ block: "nearest" });
    onNodeFocused?.();
  }, [currentFolder.id, focusedNodeId, onNodeFocused]);

  function getNodePreviewTarget(node: LibraryNode): AssetLibraryPreviewTarget | null {
    const asset = resolveLibraryAsset(activeSection, node.id);
    return asset ? { asset, name: node.name } : null;
  }

  function getEncounterPreviewTarget(
    record: EncounterRecord
  ): AssetLibraryPreviewTarget | null {
    const asset = record.state.backgroundImage;
    return asset ? { asset, name: record.state.name } : null;
  }

  const children = getAlphabetizedChildren(activeSection, currentFolder.id).filter(
    (node) => !visibleNodeIds || visibleNodeIds.has(node.id)
  );
  const visibleEncounterRecords = encounterRecords
    .filter(
      (record) =>
        record.folderId === currentFolder.id ||
        (record.folderId === null && currentFolder.id === activeSection.rootId)
    )
    .sort((left, right) => left.state.name.localeCompare(right.state.name));
  const selectedNode = children.find((node) => node.id === selectedNodeId);
  const selectedEncounter = visibleEncounterRecords.find(
    (record) => record.id === selectedNodeId
  );
  const selectedPreviewTarget =
    viewMode === "list"
      ? selectedNode
        ? getNodePreviewTarget(selectedNode)
        : selectedEncounter
          ? getEncounterPreviewTarget(selectedEncounter)
          : null
      : null;
  const displayedPreviewTarget = previewTarget ?? selectedPreviewTarget;

  function toggleViewMode() {
    const nextViewMode = viewMode === "grid" ? "list" : "grid";
    onViewModeChange?.(nextViewMode);
    if (!controlledViewMode) setLocalViewMode(nextViewMode);
  }

  return (
    <section
      aria-label="Asset library contents"
      className="flex min-h-0 flex-col overflow-hidden p-5"
      data-library-drop-folder-id={currentFolder.id}
      onDragLeave={(event) => {
        if (hasLeftDragSurface(event)) setDropFolderId(null);
      }}
      onDragOver={onDragOverContents}
      onDrop={onDropOnContents}
    >
      <div
        aria-label="Current asset library folder"
        className="mb-4 flex items-center justify-between gap-3 border-b border-canvas-line pb-3 text-sm font-semibold text-canvas-ink"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex flex-none items-center gap-2 text-canvas-muted after:content-['/']">
            <button
              aria-label="Go to parent folder"
              className="flex h-6 w-6 items-center justify-center transition hover:text-canvas-ink disabled:cursor-default disabled:opacity-40"
              disabled={!currentFolder.parentId}
              onClick={() => {
                if (currentFolder.parentId) onEnterFolder(currentFolder.parentId);
              }}
              title="Go to parent folder"
              type="button"
            >
              <FolderUp aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
          <Folder aria-hidden="true" className="h-4 w-4" />
          <span className="min-w-0 truncate">{currentFolder.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeSection.id !== "encounters" ? (
            <>
              <button
                aria-label="Play animated assets"
                aria-pressed={playAnimations}
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border transition ${playAnimations ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"} disabled:cursor-not-allowed disabled:border-canvas-line disabled:bg-canvas disabled:text-canvas-muted disabled:opacity-50`}
                disabled={!enableAssetAnimation}
                onClick={() =>
                  updateContextButtonState({ playAnimations: !playAnimations })
                }
                title={enableAssetAnimation ? "Play animated assets" : "Animations are disabled in Interface settings."}
                type="button"
              >
                <Play aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
            aria-label="Show uploaded asset sizes"
            aria-pressed={showAssetSizes}
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full border transition ${showAssetSizes ? "border-canvas-ink bg-canvas-ink text-canvas-on-ink" : "border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas"}`}
            onClick={() =>
              updateContextButtonState({ showAssetSizes: !showAssetSizes })
            }
            title="Show uploaded asset sizes"
            type="button"
          >
            <HardDrive aria-hidden="true" className="h-4 w-4" />
          </button>
            </>
          ) : null}
          <button
            aria-label={
              viewMode === "grid"
                ? "Switch library contents to list view"
                : "Switch library contents to grid view"
            }
            aria-pressed={viewMode === "grid"}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-canvas-line bg-canvas-surface text-canvas-muted transition hover:bg-canvas"
            onClick={toggleViewMode}
            title={viewMode === "grid" ? "List view" : "Grid view"}
            type="button"
          >
            {viewMode === "grid" ? (
              <List aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Grid2X2 aria-hidden="true" className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className={viewMode === "list"
        ? "min-h-0 flex-1 overflow-auto lg:grid lg:grid-cols-2 lg:gap-4 lg:overflow-hidden"
        : "min-h-0 flex-1 overflow-auto"}>
        <div
          aria-label="Current directory contents"
          className={viewMode === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3" : "space-y-2 lg:overflow-y-auto"}
          role="group"
        >
          {activeSection.id === "encounters" && currentFolder.id === activeSection.rootId && recentEncounterIds.length > 0 ? (
            <div className="mb-4 rounded-2xl border border-canvas-line bg-canvas p-3" aria-label="Recent encounters">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-canvas-muted">Recent</p>
              <div className="flex flex-wrap gap-2">
                {recentEncounterIds.flatMap((id) => {
                  const record = encounterRecords.find((item) => item.id === id);
                  return record ? [(
                    <button key={id} className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm font-medium" onDoubleClick={() => onLoadEncounter?.(id)} type="button">
                      {record.state.name}
                    </button>
                  )] : [];
                })}
              </div>
            </div>
          ) : null}
          {children.map((node) => {
            const target = getNodePreviewTarget(node);

            return (
              <AssetLibraryContentNode
                key={node.id}
                asset={target?.asset ?? null}
                buttonRef={(element) => {
                  libraryNodeCardRefs.current[node.id] = element;
                }}
                dragging={draggedItemId === node.id}
                dropFolderId={dropFolderId}
                loadingRotation={loadingRotation}
                node={node}
                selected={!draggedItemId && selectedNodeId === node.id}
                playAnimations={playAnimations}
                showAssetSize={showAssetSizes}
                viewMode={viewMode}
                onContextMenu={(event) => onOpenContextMenu(event, node)}
                onDoubleClick={() => {
                  if (!consumePreviewHold()) onDoubleClickNode(node);
                }}
                onDragOverFolder={(event) => {
                  if (node.type === "folder") onDragOverFolder(event, node);
                }}
                onDropOnFolder={(event) => {
                  if (node.type === "folder") onDropOnFolder(event, node);
                }}
                onPointerCancel={endPreviewInteraction}
                onPointerDown={(event) => {
                  beginPreviewInteraction(event, target);
                  if (!readOnly) onPointerDownNode(event, node);
                }}
                onPointerEnter={(event) => beginPreviewInteraction(event, target)}
                onPointerLeave={() => {
                  if (largeHoverPreview) schedulePreviewClear();
                }}
                onPointerMove={movePreviewInteraction}
                onPointerUp={endPreviewInteraction}
                onSelect={() => {
                  if (consumePreviewHold()) return;
                  if (node.type === "folder") {
                    onEnterFolder(node.id);
                  } else {
                    onSelectNode(node.id);
                  }
                }}
              />
            );
          })}
          {visibleEncounterRecords.map((record) => {
            const target = getEncounterPreviewTarget(record);

            return (
              <AssetLibraryEncounterItem
                key={record.id}
                dragging={draggedItemId === record.id}
                itemRef={(element) => {
                  encounterCardRefs.current[record.id] = element;
                }}
                loadingRotation={loadingRotation}
                record={record}
                selected={!draggedItemId && selectedNodeId === record.id}
                viewMode={viewMode}
                onContextMenu={(event) => {
                  onOpenEncounterContextMenu?.(event, record);
                }}
                onDoubleClick={() => {
                  if (!consumePreviewHold()) onLoadEncounter?.(record.id);
                }}
                onSelect={() => {
                  if (!consumePreviewHold()) onSelectNode(record.id);
                }}
                onPointerCancel={endPreviewInteraction}
                onPointerDown={(event) => {
                  beginPreviewInteraction(event, target);
                  if (!readOnly) onPointerDownEncounter?.(event, record);
                }}
                onPointerEnter={(event) => beginPreviewInteraction(event, target)}
                onPointerLeave={() => {
                  if (largeHoverPreview) schedulePreviewClear();
                }}
                onPointerMove={movePreviewInteraction}
                onPointerUp={endPreviewInteraction}
              />
            );
          })}
        </div>
        {viewMode === "list" && largeHoverPreview ? (
          <div
            className="hidden h-full min-h-0 min-w-0 border-l border-canvas-line pl-4 lg:block"
            onPointerEnter={clearPreviewClearTimer}
            onPointerLeave={schedulePreviewClear}
          >
            <AssetLibraryPreview
              playAnimations={playAnimations}
              rotation={loadingRotation}
              target={displayedPreviewTarget}
            />
          </div>
        ) : null}
        {viewMode === "list" && !largeHoverPreview && previewTarget ? (
          <div className="mt-4 min-w-0">
            <AssetLibraryPreview
              playAnimations={playAnimations}
              rotation={loadingRotation}
              target={displayedPreviewTarget}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
