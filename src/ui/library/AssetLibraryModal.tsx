import { X } from "lucide-react";
import { useRef, useState } from "react";

import { LIBRARY_SECTION_IDS, LIBRARY_SECTION_LABELS } from "@library/types";
import { AssetLibraryAddMenu } from "./AssetLibraryAddMenu";
import { AssetLibraryContents } from "./AssetLibraryContents";
import { AssetLibraryExplorer } from "./AssetLibraryExplorer";
import {
  AssetContextMenu,
  AssetLinkPickerDialog,
  ConfirmFolderDeleteDialog
} from "./AssetLibraryMenus";
import { useAssetLibraryModalController } from "./useAssetLibraryModalController";
import type { LibraryNode } from "@library/types";
import { WebImageUrlDialog } from "./WebImageUrlDialog";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { downloadExport } from "@ui/persistence/downloadExport";
import { RenameModal } from "@ui/RenameModal";

export type AssetLibraryMode =
  | "browse"
  | "encounter-only"
  | "save-destination"
  | "import-destination";

type AssetLibraryModalProps = {
  onClose: () => void;
  onBackgroundDoubleClick: (node: LibraryNode) => void;
  onTokenDoubleClick: (node: LibraryNode) => void;
  mode?: AssetLibraryMode;
  onCreateEncounter?: () => void;
  onActiveEncounterDeleted?: () => void;
  onRequestLoadEncounter?: (id: string) => void;
  onSaveDestinationComplete?: () => void;
  onImportDestinationSelected?: (folderId: string) => void;
  onImportEncounterFile?: (file: File) => void;
};

export function AssetLibraryModal({
  onBackgroundDoubleClick,
  onClose,
  onTokenDoubleClick,
  mode = "browse",
  onCreateEncounter,
  onActiveEncounterDeleted,
  onRequestLoadEncounter,
  onSaveDestinationComplete,
  onImportDestinationSelected,
  onImportEncounterFile
}: AssetLibraryModalProps) {
  const controller = useAssetLibraryModalController();
  const persistence = usePersistence();
  const encounterOnly = mode !== "browse";
  const pendingDeleteNode = controller.pendingDeleteNode;
  const encounterImportInputRef = useRef<HTMLInputElement>(null);
  const [renameTarget, setRenameTarget] = useState<
    | { kind: "encounter"; id: string; name: string }
    | { kind: "node"; node: LibraryNode }
    | null
  >(null);
  const renameTargetName =
    renameTarget?.kind === "encounter"
      ? renameTarget.name
      : renameTarget?.node.name;

  function folderContainsEncounters(folder: LibraryNode): boolean {
    if (controller.activeSectionId !== "encounters" || folder.type !== "folder") {
      return false;
    }
    const folderIds = new Set<string>();
    const pending = [folder.id];
    while (pending.length > 0) {
      const folderId = pending.pop() as string;
      folderIds.add(folderId);
      const node = controller.activeSection.nodesById[folderId];
      for (const childId of node?.type === "folder" ? node.childIds ?? [] : []) {
        const child = controller.activeSection.nodesById[childId];
        if (child?.type === "folder") pending.push(child.id);
      }
    }
    return persistence.encounters.some(
      (record) => record.folderId !== null && folderIds.has(record.folderId)
    );
  }

  function preventEncounterOrphan(folder: LibraryNode): boolean {
    if (!folderContainsEncounters(folder)) return false;
    window.alert("Move or delete the encounters in this folder before deleting it.");
    return true;
  }

  function handleEncounterDragOver(
    event: React.DragEvent<HTMLElement>,
    folderId: string
  ): boolean {
    if (
      !Array.from(event.dataTransfer.types ?? []).includes(
        "application/x-combat-zone-encounter"
      )
    ) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    controller.setDropFolderId(folderId);
    return true;
  }

  function handleEncounterDrop(event: React.DragEvent<HTMLElement>, folderId: string) {
    if (typeof event.dataTransfer.getData !== "function") return false;
    const encounterId = event.dataTransfer.getData(
      "application/x-combat-zone-encounter"
    );
    if (!encounterId) return false;
    event.preventDefault();
    event.stopPropagation();
    controller.setDropFolderId(null);
    void persistence.moveEncounter(encounterId, folderId);
    return true;
  }

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
          {(encounterOnly ? (["encounters"] as const) : LIBRARY_SECTION_IDS).map((sectionId) => (
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
              {!persistence.readOnly ? <AssetLibraryAddMenu
                addMenuOpen={controller.addMenuOpen}
                addMenuRef={controller.addMenuRef}
                canLinkAssets={controller.imageNodes.length > 0}
                canUploadAssets={controller.activeSectionId !== "encounters"}
                encounterSection={controller.activeSectionId === "encounters"}
                onCreateEncounter={() => {
                  controller.setAddMenuOpen(false);
                  onCreateEncounter?.();
                }}
                onCreateFolder={controller.createFolderInSelection}
                onOpenFilePicker={() => controller.fileInputRef.current?.click()}
                onOpenEncounterImportPicker={() => {
                  controller.setAddMenuOpen(false);
                  encounterImportInputRef.current?.click();
                }}
                onOpenFolderPicker={() => controller.folderInputRef.current?.click()}
                onOpenLinkPicker={() => {
                  controller.setLinkPickerOpen(true);
                  controller.setAddMenuOpen(false);
                }}
                onOpenUrlDialog={() => {
                  controller.setUrlDialogOpen(true);
                  controller.setAddMenuOpen(false);
                }}
                onToggleAddMenu={() =>
                  controller.setAddMenuOpen((open) => !open)
                }
                sectionName={controller.activeSection.name}
              /> : null}
            </div>
            <AssetLibraryExplorer
              activeSection={controller.activeSection}
              dropFolderId={controller.dropFolderId}
              expandedFolderIds={controller.expandedFolderIds}
              onDragEnd={controller.clearDragState}
              onDragOverFolder={(event, node) => {
                if (!handleEncounterDragOver(event, node.id)) {
                  controller.handleDragOverFolder(event, node);
                }
              }}
              onDragStart={(_event, node) => controller.setDraggedNodeId(node.id)}
              onDoubleClickNode={handleDoubleClick}
              onDropOnFolder={(event, node) => {
                if (!handleEncounterDrop(event, node.id)) {
                  controller.handleDropOnFolder(event, node);
                }
              }}
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
            encounterRecords={
              controller.activeSectionId === "encounters"
                ? persistence.encounters
                : []
            }
            onDeleteEncounter={(id) => {
              void persistence.deleteEncounter(id).then((deletedActive) => {
                if (deletedActive) onActiveEncounterDeleted?.();
              });
            }}
            onDuplicateEncounter={(id) => void persistence.duplicateEncounter(id)}
            onExportEncounter={(id, name) => {
              void persistence.exportEncounter(id).then((envelope) =>
                downloadExport(
                  envelope,
                  `${name.trim().replace(/[^a-z0-9_-]+/gi, "-") || "encounter"}.json`
                )
              );
            }}
            onLoadEncounter={(id) => {
              if (onRequestLoadEncounter) {
                onRequestLoadEncounter(id);
              } else {
                void persistence.loadEncounter(id).then(onClose);
              }
            }}
            onRequestRenameEncounter={(id, name) =>
              setRenameTarget({ kind: "encounter", id, name })
            }
            readOnly={persistence.readOnly}
            onDragOverContents={(event) => {
              if (!handleEncounterDragOver(event, controller.currentFolder.id)) {
                controller.handleDragOverContents(event);
              }
            }}
            onDragOverFolder={(event, node) => {
              if (!handleEncounterDragOver(event, node.id)) {
                controller.handleDragOverFolder(event, node);
              }
            }}
            onDragStart={(_event, node) => controller.setDraggedNodeId(node.id)}
            onDoubleClickNode={handleDoubleClick}
            onDropOnContents={(event) => {
              if (!handleEncounterDrop(event, controller.currentFolder.id)) {
                controller.handleDropOnContents(event);
              }
            }}
            onDropOnFolder={(event, node) => {
              if (!handleEncounterDrop(event, node.id)) {
                controller.handleDropOnFolder(event, node);
              }
            }}
            onEnterFolder={controller.enterFolder}
            onOpenContextMenu={controller.openContextMenuForNode}
            onSelectNode={controller.selectNode}
            selectedNodeId={controller.selectedNodeId}
            setDropFolderId={controller.setDropFolderId}
          />
        </div>
        {mode === "save-destination" || mode === "import-destination" ? (
          <footer className="flex items-center justify-between border-t border-canvas-line px-5 py-3">
            <p className="text-sm text-canvas-muted">
              {mode === "save-destination" ? "Save" : "Import"} to {controller.currentFolder.name}
            </p>
            <button
              className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white"
              onClick={() => {
                if (mode === "import-destination") {
                  onImportDestinationSelected?.(controller.currentFolder.id);
                  onClose();
                } else {
                  void persistence.save(controller.currentFolder.id).then(() => {
                    onClose();
                    onSaveDestinationComplete?.();
                  });
                }
              }}
              type="button"
            >
              {mode === "save-destination" ? "Save here" : "Import here"}
            </button>
          </footer>
        ) : null}
      </div>
      <input
        ref={encounterImportInputRef}
        accept="application/json,.json"
        aria-label="Import encounter JSON"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onImportEncounterFile?.(file);
        }}
        type="file"
      />
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
          onDelete={(node) => {
            if (!preventEncounterOrphan(node)) controller.handleDelete(node);
          }}
          onRename={(node) => {
            controller.setContextMenu(null);
            setRenameTarget({ kind: "node", node });
          }}
          readOnly={persistence.readOnly}
        />
      ) : null}
      {pendingDeleteNode ? (
        <ConfirmFolderDeleteDialog
          node={pendingDeleteNode}
          onCancel={() => controller.setPendingDeleteNodeId(null)}
          onDelete={() => {
            if (!preventEncounterOrphan(pendingDeleteNode)) {
              controller.confirmDeletePendingFolder();
            }
          }}
        />
      ) : null}
      {controller.linkPickerOpen ? (
        <AssetLinkPickerDialog
          imageNodes={controller.imageNodes}
          onClose={() => controller.setLinkPickerOpen(false)}
          onSelectAsset={controller.createLinkToAsset}
        />
      ) : null}
      {controller.urlDialogOpen ? (
        <WebImageUrlDialog
          description="The library will keep a reference to this URL; the image file will not be copied into the library."
          onClose={() => controller.setUrlDialogOpen(false)}
          onSubmit={controller.createUrlAsset}
          title="Link image URL"
        />
      ) : null}
      {renameTarget ? (
        <RenameModal
          ariaLabel={`Rename ${renameTargetName}`}
          initialName={renameTargetName}
          inputLabel="New library item name"
          onClose={() => setRenameTarget(null)}
          onRename={(name) => {
            if (renameTarget.kind === "encounter") {
              void persistence.renameEncounter(renameTarget.id, name);
            } else {
              controller.renameLibraryNode(renameTarget.node, name);
            }
          }}
          title="Rename library item"
        />
      ) : null}
    </div>
  );
}
