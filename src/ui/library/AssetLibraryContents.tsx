import { Folder, FolderUp, Grid2X2, List } from "lucide-react";
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
  AssetLibraryPreviewTarget,
  AssetLibraryViewMode
} from "./assetLibraryView";
import { useAssetLibraryPreview } from "./useAssetLibraryPreview";
import type { EncounterRecord } from "@core/persistence";
import {
  EncounterContextMenu,
  type EncounterContextMenuState
} from "./AssetLibraryMenus";

type AssetLibraryContentsProps = {
  activeSection: LibrarySection;
  currentFolder: LibraryNode;
  dropFolderId: string | null;
  selectedNodeId: string | undefined;
  viewMode?: AssetLibraryViewMode;
  onViewModeChange?: (viewMode: AssetLibraryViewMode) => void;
  onDragOverContents: (event: DragEvent<HTMLElement>) => void;
  onDragOverFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onPointerDownNode: (
    event: ReactPointerEvent<HTMLElement>,
    node: LibraryNode
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
  onDeleteEncounter?: (id: string) => void;
  onDuplicateEncounter?: (id: string) => void;
  onExportEncounter?: (id: string, name: string) => void;
  onLoadEncounter?: (id: string) => void;
  onRequestRenameEncounter?: (id: string, name: string) => void;
  readOnly?: boolean;
  recentEncounterIds?: string[];
  focusedEncounterId?: string | null;
  focusedNodeId?: string | null;
  visibleNodeIds?: Set<string> | null;
};

export function AssetLibraryContents({
  activeSection,
  currentFolder,
  dropFolderId,
  selectedNodeId,
  viewMode: controlledViewMode,
  onViewModeChange,
  onDragOverContents,
  onDragOverFolder,
  onPointerDownNode,
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
  onDeleteEncounter,
  onDuplicateEncounter,
  onExportEncounter,
  onLoadEncounter,
  onRequestRenameEncounter,
  readOnly = false,
  recentEncounterIds = [],
  focusedEncounterId = null,
  focusedNodeId = null,
  visibleNodeIds = null
}: AssetLibraryContentsProps) {
  const time = useTime();
  const [encounterContextMenu, setEncounterContextMenu] =
    useState<EncounterContextMenuState>(null);
  const encounterContextMenuRef = useRef<HTMLDivElement>(null);
  const encounterCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const libraryNodeCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [localViewMode, setLocalViewMode] =
    useState<AssetLibraryViewMode>("grid");
  const viewMode = controlledViewMode ?? localViewMode;
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
    if (!encounterContextMenu) return;

    function handlePointerDown(event: PointerEvent) {
      if (!encounterContextMenuRef.current?.contains(event.target as Node)) {
        setEncounterContextMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [encounterContextMenu]);

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
                dropFolderId={dropFolderId}
                loadingRotation={loadingRotation}
                node={node}
                selected={selectedNodeId === node.id}
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
                itemRef={(element) => {
                  encounterCardRefs.current[record.id] = element;
                }}
                loadingRotation={loadingRotation}
                readOnly={readOnly}
                record={record}
                selected={selectedNodeId === record.id}
                viewMode={viewMode}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setEncounterContextMenu({
                    encounterId: record.id,
                    name: record.state.name,
                    x: event.clientX,
                    y: event.clientY
                  });
                }}
                onDoubleClick={() => {
                  if (!consumePreviewHold()) onLoadEncounter?.(record.id);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "application/x-combat-zone-encounter",
                    record.id
                  );
                }}
                onSelect={() => {
                  if (!consumePreviewHold()) onSelectNode(record.id);
                }}
                onPointerCancel={endPreviewInteraction}
                onPointerDown={(event) => beginPreviewInteraction(event, target)}
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
              rotation={loadingRotation}
              target={displayedPreviewTarget}
            />
          </div>
        ) : null}
        {viewMode === "list" && !largeHoverPreview && previewTarget ? (
          <div className="mt-4 min-w-0">
            <AssetLibraryPreview
              rotation={loadingRotation}
              target={displayedPreviewTarget}
            />
          </div>
        ) : null}
      </div>
      {encounterContextMenu ? (
        <EncounterContextMenu
          contextMenu={encounterContextMenu}
          contextMenuRef={encounterContextMenuRef}
          onDelete={(id, name) => {
            setEncounterContextMenu(null);
            if (window.confirm(`Delete "${name}"?`)) {
              onDeleteEncounter?.(id);
            }
          }}
          onDuplicate={(id) => {
            setEncounterContextMenu(null);
            onDuplicateEncounter?.(id);
          }}
          onExport={(id, name) => {
            setEncounterContextMenu(null);
            onExportEncounter?.(id, name);
          }}
          onRename={(id, name) => {
            setEncounterContextMenu(null);
            onRequestRenameEncounter?.(id, name);
          }}
          readOnly={readOnly}
        />
      ) : null}
    </section>
  );
}
