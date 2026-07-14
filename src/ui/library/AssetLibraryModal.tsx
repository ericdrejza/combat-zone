import { X } from "lucide-react";

import { LIBRARY_SECTION_IDS, LIBRARY_SECTION_LABELS } from "../../library/types";
import { AssetLibraryAddMenu } from "./AssetLibraryAddMenu";
import { AssetLibraryContents } from "./AssetLibraryContents";
import { AssetLibraryExplorer } from "./AssetLibraryExplorer";
import {
  AssetContextMenu,
  AssetLinkPickerDialog,
  ConfirmFolderDeleteDialog
} from "./AssetLibraryMenus";
import { useAssetLibraryModalController } from "./useAssetLibraryModalController";
import type { LibraryNode } from "../../library/types";

type AssetLibraryModalProps = {
  onClose: () => void;
  onBackgroundDoubleClick: (node: LibraryNode) => void;
  onTokenDoubleClick: (node: LibraryNode) => void;
};

export function AssetLibraryModal({
  onBackgroundDoubleClick,
  onClose,
  onTokenDoubleClick
}: AssetLibraryModalProps) {
  const controller = useAssetLibraryModalController();

  function handleDoubleClick(node: LibraryNode) {
    if (node.type === "folder") {
      return;
    }

    if (controller.activeSectionId === "tokens") {
      onTokenDoubleClick(node);
    }

    if (controller.activeSectionId === "backgrounds") {
      onBackgroundDoubleClick(node);
    }
  }

  return (
    <div
      aria-label="Asset Library"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      role="dialog"
    >
      <div className="flex h-[min(44rem,92vh)] w-[min(68rem,96vw)] flex-col overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-2xl">
        <header className="flex items-center justify-between border-b border-canvas-line px-5 py-4">
          <h2 className="font-display text-xl font-semibold">Asset Library</h2>
          <button
            aria-label="Close Asset Library"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-muted transition hover:bg-canvas"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <div className="flex border-b border-canvas-line px-5 pt-3" role="tablist">
          {LIBRARY_SECTION_IDS.map((sectionId) => (
            <button
              key={sectionId}
              aria-selected={controller.activeSectionId === sectionId}
              className={`rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
                controller.activeSectionId === sectionId
                  ? "border-canvas-line bg-white text-canvas-ink"
                  : "border-transparent text-canvas-muted hover:bg-canvas"
              }`}
              onClick={() => {
                controller.setActiveSectionId(sectionId);
                controller.setContextMenu(null);
              }}
              role="tab"
              type="button"
            >
              {LIBRARY_SECTION_LABELS[sectionId]}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="min-h-0 border-r border-canvas-line p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {controller.activeSection.name}
              </h3>
              <AssetLibraryAddMenu
                addMenuOpen={controller.addMenuOpen}
                addMenuRef={controller.addMenuRef}
                canLinkAssets={controller.imageNodes.length > 0}
                canUploadAssets={controller.activeSectionId !== "encounters"}
                onCreateFolder={controller.createFolderInSelection}
                onOpenFilePicker={() => controller.fileInputRef.current?.click()}
                onOpenFolderPicker={() => controller.folderInputRef.current?.click()}
                onOpenLinkPicker={() => {
                  controller.setLinkPickerOpen(true);
                  controller.setAddMenuOpen(false);
                }}
                onToggleAddMenu={() =>
                  controller.setAddMenuOpen((open) => !open)
                }
                sectionName={controller.activeSection.name}
              />
            </div>
            <AssetLibraryExplorer
              activeSection={controller.activeSection}
              dropFolderId={controller.dropFolderId}
              expandedFolderIds={controller.expandedFolderIds}
              onDragEnd={controller.clearDragState}
              onDragOverFolder={controller.handleDragOverFolder}
              onDragStart={(_event, node) => controller.setDraggedNodeId(node.id)}
              onDoubleClickNode={handleDoubleClick}
              onDropOnFolder={controller.handleDropOnFolder}
              onEnterFolder={controller.enterFolder}
              onOpenContextMenu={controller.openContextMenuForNode}
              onSearchQueryChange={controller.setSearchQuery}
              onSelectNode={controller.selectNode}
              onToggleFolder={controller.toggleFolder}
              searchQuery={controller.searchQuery}
              selectedNodeId={controller.selectedNodeId}
              setDropFolderId={controller.setDropFolderId}
            />
          </aside>
          <AssetLibraryContents
            activeSection={controller.activeSection}
            currentFolder={controller.currentFolder}
            dropFolderId={controller.dropFolderId}
            onDragEnd={controller.clearDragState}
            onDragOverContents={controller.handleDragOverContents}
            onDragOverFolder={controller.handleDragOverFolder}
            onDragStart={(_event, node) => controller.setDraggedNodeId(node.id)}
            onDoubleClickNode={handleDoubleClick}
            onDropOnContents={controller.handleDropOnContents}
            onDropOnFolder={controller.handleDropOnFolder}
            onEnterFolder={controller.enterFolder}
            onOpenContextMenu={controller.openContextMenuForNode}
            onSelectNode={controller.selectNode}
            selectedNodeId={controller.selectedNodeId}
            setDropFolderId={controller.setDropFolderId}
          />
        </div>
      </div>
      <input
        ref={controller.fileInputRef}
        accept="image/*"
        aria-label="Upload library image"
        className="sr-only"
        multiple
        onChange={(event) => {
          void controller.handleFileChange(event);
        }}
        type="file"
      />
      <input
        ref={controller.folderInputRef}
        accept="image/*"
        aria-label="Upload library folder"
        className="sr-only"
        onChange={(event) => {
          void controller.handleFolderChange(event);
        }}
        type="file"
        {...{ directory: "", multiple: true, webkitdirectory: "" }}
      />
      {controller.contextMenu && controller.contextNode ? (
        <AssetContextMenu
          contextMenu={controller.contextMenu}
          contextMenuRef={controller.contextMenuRef}
          node={controller.contextNode}
          onDelete={controller.handleDelete}
          onRename={controller.handleRename}
        />
      ) : null}
      {controller.pendingDeleteNode ? (
        <ConfirmFolderDeleteDialog
          node={controller.pendingDeleteNode}
          onCancel={() => controller.setPendingDeleteNodeId(null)}
          onDelete={controller.confirmDeletePendingFolder}
        />
      ) : null}
      {controller.linkPickerOpen ? (
        <AssetLinkPickerDialog
          imageNodes={controller.imageNodes}
          onClose={() => controller.setLinkPickerOpen(false)}
          onSelectAsset={controller.createLinkToAsset}
        />
      ) : null}
    </div>
  );
}
