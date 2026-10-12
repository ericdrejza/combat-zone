import { Plus } from "lucide-react";
import { useState } from "react";

import type { LibrarySection } from "@library/types";
import { TouchTooltip } from "@ui/toolbar/TouchTooltip";
import { AssetLibraryContents } from "./AssetLibraryContents";
import { AssetLibraryExplorer } from "./AssetLibraryExplorer";

// Render-only adapter for the shared Tokens explorer/card components. This is
// not a stored section or a Character record; future Characters link to tokens.
const emptySection: LibrarySection = {
  id: "tokens",
  name: "Characters",
  rootId: "characters-placeholder-root",
  nodesById: {
    "characters-placeholder-root": {
      id: "characters-placeholder-root",
      name: "Characters",
      parentId: null,
      sectionId: "tokens",
      type: "folder",
      childIds: []
    }
  }
};
const ignore = () => undefined;

/** Reuses asset browsing views without enabling character mutations before that feature exists. */
export function AssetLibraryCharactersTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expanded, setExpanded] = useState(true);
  const root = emptySection.nodesById[emptySection.rootId];
  return <>
    <aside className="min-h-0 overflow-hidden border-b border-canvas-line p-3 lg:border-b-0 lg:border-r lg:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Characters</h3>
        <TouchTooltip label="Adding Characters will be available with the Characters feature.">
          <button aria-label="Add to Characters" className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-canvas text-canvas-muted opacity-50 disabled:cursor-not-allowed" disabled type="button">
            <Plus aria-hidden="true" className="h-4 w-4" />
          </button>
        </TouchTooltip>
      </div>
      <AssetLibraryExplorer
        activeSection={emptySection}
        currentFolderId={root.id}
        dropFolderId={null}
        expandedFolderIds={new Set(expanded ? [root.id] : [])}
        searchQuery={searchQuery}
        selectedNodeId={root.id}
        onDragOverFolder={ignore}
        onPointerDownNode={ignore}
        onDropOnFolder={ignore}
        onDoubleClickNode={ignore}
        onOpenContextMenu={ignore}
        onSearchQueryChange={setSearchQuery}
        onSelectNode={ignore}
        onToggleFolder={() => setExpanded((value) => !value)}
        onEnterFolder={ignore}
        setDropFolderId={ignore}
      />
    </aside>
    <AssetLibraryContents
      activeSection={emptySection}
      currentFolder={root}
      dropFolderId={null}
      selectedNodeId={root.id}
      readOnly
      onDragOverContents={ignore}
      onDragOverFolder={ignore}
      onPointerDownNode={ignore}
      onDropOnContents={ignore}
      onDropOnFolder={ignore}
      onDoubleClickNode={ignore}
      onEnterFolder={ignore}
      onOpenContextMenu={ignore}
      onSelectNode={ignore}
      setDropFolderId={ignore}
    />
  </>;
}
