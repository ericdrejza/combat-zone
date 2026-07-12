import {
  ChevronDown,
  ChevronRight,
  FileImage,
  Folder,
  Link,
  MoreHorizontal,
  Search
} from "lucide-react";
import type { DragEvent } from "react";

import type { LibraryNode, LibrarySection } from "../../library/types";
import { LIBRARY_NODE_DRAG_TYPE } from "./libraryDrag";
import { getAlphabetizedChildren } from "./libraryUi";

type AssetLibraryExplorerProps = {
  activeSection: LibrarySection;
  dropFolderId: string | null;
  expandedFolderIds: Set<string>;
  searchQuery: string;
  selectedNodeId: string | undefined;
  onDragEnd: () => void;
  onDragOverFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
  onDragStart: (event: DragEvent<HTMLElement>, node: LibraryNode) => void;
  onDropOnFolder: (
    event: DragEvent<HTMLElement>,
    node: LibraryNode
  ) => void;
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
  setDropFolderId: (folderId: string | null) => void;
};

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

export function AssetLibraryExplorer({
  activeSection,
  dropFolderId,
  expandedFolderIds,
  searchQuery,
  selectedNodeId,
  onDragEnd,
  onDragOverFolder,
  onDragStart,
  onDropOnFolder,
  onEnterFolder,
  onOpenContextMenu,
  onSearchQueryChange,
  onSelectNode,
  onToggleFolder,
  setDropFolderId
}: AssetLibraryExplorerProps) {
  function nodeMatchesSearch(node: LibraryNode, query: string): boolean {
    if (!query) {
      return true;
    }

    if (node.name.toLowerCase().includes(query)) {
      return true;
    }

    if (node.type !== "folder") {
      return false;
    }

    return getAlphabetizedChildren(activeSection, node.id).some((child) =>
      nodeMatchesSearch(child, query)
    );
  }

  function getSearchVisibleChildren(folderId: string) {
    const query = normalizeSearchValue(searchQuery);

    return getAlphabetizedChildren(activeSection, folderId).filter((child) =>
      nodeMatchesSearch(child, query)
    );
  }

  function renderTreeNode(node: LibraryNode, depth: number) {
    const isFolder = node.type === "folder";
    const expanded = expandedFolderIds.has(node.id);
    const isRoot = node.id === activeSection.rootId;
    const selected = selectedNodeId === node.id;

    return (
      <div key={node.id}>
        <div
          aria-selected={selected}
          className={`group flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm transition ${
            dropFolderId === node.id
              ? "bg-canvas-ink text-white"
              : selected
                ? "bg-canvas text-canvas-ink"
                : "text-canvas-ink hover:bg-canvas"
          }`}
          draggable={!isRoot}
          onClick={() => {
            if (isFolder) {
              onEnterFolder(node.id);
              return;
            }

            onSelectNode(node.id);
          }}
          onContextMenu={(event) => onOpenContextMenu(event, node)}
          onDragEnd={onDragEnd}
          onDragStart={(event) => {
            if (isRoot) {
              event.preventDefault();
              return;
            }

            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData(LIBRARY_NODE_DRAG_TYPE, node.id);
            event.dataTransfer.setData("text/plain", node.id);
            onDragStart(event, node);
          }}
          onDragLeave={() => {
            if (dropFolderId === node.id) {
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
            <Folder aria-hidden="true" className="h-4 w-4" />
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
              type="button"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {isFolder && (expanded || normalizeSearchValue(searchQuery))
          ? getSearchVisibleChildren(node.id).map((child) =>
              renderTreeNode(child, depth + 1)
            )
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
