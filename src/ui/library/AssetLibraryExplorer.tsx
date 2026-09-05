import {
  ChevronDown,
  ChevronRight,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderOpenDot,
  Link,
  MoreHorizontal,
  Search
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { DragEvent, PointerEvent, ReactNode } from "react";

import type { EncounterRecord } from "@core/persistence";
import type { LibraryNode, LibrarySection } from "@library/types";
import { hasLeftDragSurface } from "./libraryDrag";
import { getAlphabetizedChildren } from "./libraryUi";

type AssetLibraryExplorerProps = {
  activeSection: LibrarySection;
  currentFolderId: string;
  dropFolderId: string | null;
  encounterRecords?: EncounterRecord[];
  expandedFolderIds: Set<string>;
  searchQuery: string;
  selectedNodeId: string | undefined;
  onDragOverFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onPointerDownNode: (
    event: PointerEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDropOnFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDoubleClickNode: (node: LibraryNode) => void;
  onFolderFocused?: () => void;
  onOpenContextMenu: (
    event: {
      clientX: number;
      clientY: number;
      preventDefault: () => void;
    },
    node: LibraryNode
  ) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectNode: (nodeId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onEnterFolder: (folderId: string) => void;
  onSelectEncounter?: (encounterId: string) => void;
  onDoubleClickEncounter?: (encounterId: string) => void;
  setDropFolderId: (folderId: string | null) => void;
  focusedFolderId?: string | null;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function AssetLibraryExplorer({
  activeSection,
  currentFolderId,
  dropFolderId,
  encounterRecords = [],
  expandedFolderIds,
  searchQuery,
  selectedNodeId,
  onDragOverFolder,
  onPointerDownNode,
  onDropOnFolder,
  onDoubleClickNode,
  onFolderFocused,
  onEnterFolder,
  onSelectEncounter,
  onDoubleClickEncounter,
  onOpenContextMenu,
  onSearchQueryChange,
  onSelectNode,
  onToggleFolder,
  setDropFolderId,
  focusedFolderId = null
}: AssetLibraryExplorerProps) {
  const folderRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!focusedFolderId) {
      return;
    }

    const row = folderRowRefs.current[focusedFolderId];

    if (!row) {
      return;
    }

    row.scrollIntoView?.({ block: "nearest" });
    onFolderFocused?.();
  }, [activeSection.id, expandedFolderIds, focusedFolderId, onFolderFocused]);

  function nodeMatchesSearch(
    node: LibraryNode,
    query: string,
    visited = new Set<string>()
  ): boolean {
    if (visited.has(node.id)) {
      return false;
    }

    visited.add(node.id);

    if (!query) {
      return true;
    }

    if (node.name.toLowerCase().includes(query)) {
      return true;
    }

    if (node.type !== "folder") {
      return false;
    }

    return (
      getSearchVisibleEncounters(node.id).length > 0 ||
      getAlphabetizedChildren(activeSection, node.id).some((child) =>
        nodeMatchesSearch(child, query, visited)
      )
    );
  }

  function getSearchVisibleChildren(folderId: string) {
    const query = normalizeSearchValue(searchQuery);

    return getAlphabetizedChildren(activeSection, folderId).filter((child) =>
      nodeMatchesSearch(child, query)
    );
  }

  function getSearchVisibleEncounters(folderId: string) {
    const query = normalizeSearchValue(searchQuery);

    return encounterRecords
      .filter(
        (record) =>
          (record.folderId === folderId ||
            (record.folderId === null && folderId === activeSection.rootId)) &&
          (!query || record.state.name.toLowerCase().includes(query))
      )
      .sort((left, right) => left.state.name.localeCompare(right.state.name));
  }

  function renderEncounter(record: EncounterRecord, depth: number) {
    const selected = selectedNodeId === record.id;

    return (
      <div
        key={record.id}
        aria-selected={selected}
        className={`flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm transition ${
          selected
            ? "bg-canvas text-canvas-ink"
            : "text-canvas-ink hover:bg-canvas"
        }`}
        onClick={() => {
          onEnterFolder(record.folderId ?? activeSection.rootId);
          onSelectEncounter?.(record.id);
        }}
        onDoubleClick={() => onDoubleClickEncounter?.(record.id)}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <span className="h-6 w-6" />
        <FileText aria-hidden="true" className="h-4 w-4" />
        <span className="min-w-0 flex-1 truncate">{record.state.name}</span>
      </div>
    );
  }

  function renderTreeNode(
    node: LibraryNode,
    depth: number,
    ancestors = new Set<string>()
  ): ReactNode {
    if (ancestors.has(node.id)) {
      return null;
    }

    const nextAncestors = new Set(ancestors).add(node.id);
    const isFolder = node.type === "folder";
    const expanded = expandedFolderIds.has(node.id);
    const isRoot = node.id === activeSection.rootId;
    const current = node.id === currentFolderId;
    const selected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          aria-selected={selected}
          className={`group flex min-h-9 touch-none select-none items-center gap-2 rounded-lg px-2 text-sm transition ${
            dropFolderId === node.id
              ? "bg-canvas-ink text-white"
              : selected
                ? "bg-canvas text-canvas-ink"
                : "text-canvas-ink hover:bg-canvas"
          }`}
          data-library-drag-node-id={isRoot ? undefined : node.id}
          data-library-drop-folder-id={isFolder ? node.id : undefined}
          draggable={false}
          ref={(element) => {
            folderRowRefs.current[node.id] = element;
          }}
          onClick={() => {
            if (isFolder) {
              onToggleFolder(node.id);
              onEnterFolder(node.id);
              return;
            }

            if (node.parentId) {
              onEnterFolder(node.parentId);
            }
            onSelectNode(node.id);
          }}
          onContextMenu={(event) => onOpenContextMenu(event, node)}
          onDoubleClick={() => {
            if (!isFolder) {
              onDoubleClickNode(node);
            }
          }}
          onPointerDown={(event) => {
            if (!isRoot) onPointerDownNode(event, node);
          }}
          onDragLeave={(event) => {
            if (
              dropFolderId === node.id &&
              hasLeftDragSurface(event)
            ) {
              setDropFolderId(null);
            }
          }}
          onDragOver={(event) => {
            if (isFolder) {
              onDragOverFolder(event, node);
            }
          }}
          onDrop={(event) => {
            if (isFolder) {
              onDropOnFolder(event, node);
            }
          }}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {isFolder ? (
            <button
              aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-md transition hover:bg-white/60"
              onClick={(event) => {
                event.stopPropagation();
                onToggleFolder(node.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              {expanded ? (
                <ChevronDown aria-hidden="true" className="h-4 w-4" />
              ) : (
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="h-6 w-6" />
          )}
          {isFolder ? (
            current ? (
              <FolderOpenDot aria-hidden="true" className="h-4 w-4" />
            ) : expanded ? (
              <FolderOpen aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Folder aria-hidden="true" className="h-4 w-4" />
            )
          ) : node.type === "link" ? (
            <Link aria-hidden="true" className="h-4 w-4" />
          ) : (
            <FileImage aria-hidden="true" className="h-4 w-4" />
          )}
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {!isRoot ? (
            <button
              aria-label={`Open ${node.name} actions`}
              className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition hover:bg-white/70 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                const bounds = event.currentTarget.getBoundingClientRect();
                onSelectNode(node.id);
                onOpenContextMenu(
                  {
                    clientX: bounds.left,
                    clientY: bounds.bottom,
                    preventDefault: () => undefined
                  },
                  node
                );
              }}
              onPointerDown={(event) => event.stopPropagation()}
              type="button"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {isFolder && (expanded || normalizeSearchValue(searchQuery))
          ? [
              ...getSearchVisibleChildren(node.id).map((child) =>
                renderTreeNode(child, depth + 1, nextAncestors)
              ),
              ...getSearchVisibleEncounters(node.id).map((record) =>
                renderEncounter(record, depth + 1)
              )
            ]
          : null}
      </div>
    );
  }

  return (
    <>
      <div className="mb-3">
        <label className="sr-only" htmlFor="asset-library-search">
          Search asset library
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-canvas-line bg-white px-3 py-2 text-sm text-canvas-muted">
          <Search aria-hidden="true" className="h-4 w-4" />
          <input
            className="min-w-0 flex-1 bg-transparent text-canvas-ink outline-none placeholder:text-canvas-muted"
            id="asset-library-search"
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search"
            type="search"
            value={searchQuery}
          />
        </div>
      </div>
      <div className="max-h-full overflow-y-auto">
        {renderTreeNode(activeSection.nodesById[activeSection.rootId], 0)}
      </div>
    </>
  );
}
