import { Crosshair, Target, X } from "lucide-react";
import { useRef, useState } from "react";
import { useSelector } from "react-redux";

import { LIBRARY_SECTION_IDS, LIBRARY_SECTION_LABELS } from "@library/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import {
  AssetLibraryAddMenu,
  type AssetSourceType
} from "./AssetLibraryAddMenu";
import { AssetLibraryContents } from "./AssetLibraryContents";
import { AssetLibraryExplorer } from "./AssetLibraryExplorer";
import {
  AssetContextMenu,
  AssetLinkPickerDialog,
  ConfirmFolderDeleteDialog
} from "./AssetLibraryMenus";
import { useAssetLibraryModalController } from "./useAssetLibraryModalController";
import type { LibraryNode, LibrarySectionId } from "@library/types";
import type { RootState } from "@store/store";
import { WebImageUrlDialog } from "./WebImageUrlDialog";
import { usePersistence } from "@ui/persistence/PersistenceProvider";
import { downloadExport } from "@ui/persistence/downloadExport";
import { RenameModal } from "@ui/RenameModal";
import { useOptionalCloudSync } from "@ui/cloud_sync";
import type { LibraryFolderBySection } from "./useAssetLibraryModalState";
import type { LibraryViewModeBySection } from "./useAssetLibraryModalState";
import type { AssetLibraryViewMode } from "./assetLibraryView";
import { getFolderAncestorIds } from "./libraryUi";
import { LibraryPointerDragPreview } from "./LibraryPointerDragPreview";
import { useLibraryNodePointerDrag } from "./useLibraryNodePointerDrag";

export type AssetLibraryMode =
  | "browse"
  | "encounter-only"
  | "save-destination"
  | "import-destination";

type AssetLibraryModalProps = {
  currentFolderBySection: LibraryFolderBySection;
  initialSectionId?: LibrarySectionId;
  viewModeBySection?: LibraryViewModeBySection;
  onClose: () => void;
  onCurrentFolderChange: (
    sectionId: keyof LibraryFolderBySection,
    folderId: string
  ) => void;
  onViewModeChange?: (
    sectionId: keyof LibraryViewModeBySection,
    viewMode: AssetLibraryViewMode
  ) => void;
  onBackgroundDoubleClick: (node: LibraryNode) => void;
  onTokenDoubleClick: (node: LibraryNode) => void;
  tokenSubmitLabel?: string;
  mode?: AssetLibraryMode;
  onCreateEncounter?: () => void;
  onActiveEncounterDeleted?: () => void;
  onRequestLoadEncounter?: (id: string) => void;
  onSaveDestinationComplete?: () => void;
  onImportDestinationSelected?: (folderId: string) => void;
  onImportEncounterFile?: (file: File) => void;
};

export function AssetLibraryModal({
  currentFolderBySection,
  onBackgroundDoubleClick,
  onClose,
  onCurrentFolderChange,
  initialSectionId = "encounters",
  onViewModeChange = () => undefined,
  onTokenDoubleClick,
  tokenSubmitLabel = "Create Actor",
  viewModeBySection = {},
  mode = "browse",
  onCreateEncounter,
  onActiveEncounterDeleted,
  onRequestLoadEncounter,
  onSaveDestinationComplete,
  onImportDestinationSelected,
  onImportEncounterFile
}: AssetLibraryModalProps) {
  const controller = useAssetLibraryModalController({
    currentFolderBySection,
    initialSectionId: mode === "browse" ? initialSectionId : "encounters",
    onCurrentFolderChange,
    onViewModeChange,
    viewModeBySection
  });
  const persistence = usePersistence();
  const cloud = useOptionalCloudSync();
  const activeBackgroundImage = useSelector(
    (state: RootState) => state.encounter.present.backgroundImage
  );
  const encounterOnly = mode !== "browse";
  const pendingDeleteNode = controller.pendingDeleteNode;
  const encounterImportInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<LibraryNode | null>(null);
  const [focusedEncounterId, setFocusedEncounterId] = useState<string | null>(
    null
  );
  const [focusedFolderId, setFocusedFolderId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<
    | { kind: "encounter"; id: string; name: string }
    | { kind: "node"; node: LibraryNode }
    | null
  >(null);
  const renameTargetName =
    renameTarget?.kind === "encounter"
      ? renameTarget.name
    : renameTarget?.node.name;
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [urlReplacementTarget, setUrlReplacementTarget] =
    useState<LibraryNode | null>(null);
  const [linkReplacementTarget, setLinkReplacementTarget] =
    useState<LibraryNode | null>(null);

  const { preview: pointerDragPreview, startPointerDrag } =
    useLibraryNodePointerDrag({
      enabled: !persistence.readOnly,
      onDragEnd: controller.clearDragState,
      onDragStart: controller.setDraggedNodeId,
      onDrop: controller.moveLibraryNodeToFolderById,
      onTargetChange: controller.setDropFolderId
    });

  function folderContainsEncounters(folder: LibraryNode): boolean {
    if (controller.activeSectionId !== "encounters" || folder.type !== "folder") {
      return false;
    }
    const folderIds = new Set<string>();
    const pending = [folder.id];
    while (pending.length > 0) {
      const folderId = pending.pop() as string;

      if (folderIds.has(folderId)) {
        continue;
      }

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

  function loadEncounter(id: string) {
    if (onRequestLoadEncounter) {
      onRequestLoadEncounter(id);
    } else {
      void persistence.loadEncounter(id).then(onClose);
    }
  }

  function locateActiveEncounter() {
    const activeRecord = persistence.activeRecord;

    if (!activeRecord) {
      return;
    }

    const encounterSection = controller.activeSection;
    const folderId =
      activeRecord.folderId &&
      encounterSection.nodesById[activeRecord.folderId]?.type === "folder"
        ? activeRecord.folderId
        : encounterSection.rootId;

    controller.expandFolders(getFolderAncestorIds(encounterSection, folderId));
    controller.enterFolder(folderId);
    setFocusedNodeId(null);
    setFocusedEncounterId(activeRecord.id);
  }

  function getActiveBackgroundNode(): LibraryNode | null {
    if (
      controller.activeSectionId !== "backgrounds" ||
      !activeBackgroundImage?.libraryNodeId
    ) {
      return null;
    }

    const node = controller.activeSection.nodesById[activeBackgroundImage.libraryNodeId];
    return node?.type === "image" || node?.type === "link" ? node : null;
  }

  function locateActiveBackground() {
    const activeBackgroundNode = getActiveBackgroundNode();

    if (!activeBackgroundNode) {
      return;
    }

    const backgroundSection = controller.activeSection;
    const folderId =
      activeBackgroundNode.parentId &&
      backgroundSection.nodesById[activeBackgroundNode.parentId]?.type === "folder"
        ? activeBackgroundNode.parentId
        : backgroundSection.rootId;

    controller.expandFolders(getFolderAncestorIds(backgroundSection, folderId));
    controller.enterFolder(folderId);
    controller.selectNode(activeBackgroundNode.id);
    setFocusedEncounterId(null);
    setFocusedNodeId(activeBackgroundNode.id);
  }

  function locateCurrentFolder() {
    const currentFolder = controller.currentFolder;

    controller.expandFolders(
      getFolderAncestorIds(controller.activeSection, currentFolder.id)
    );
    setFocusedEncounterId(null);
    setFocusedFolderId(currentFolder.id);
  }

  function openCreateFolderDialog() {
    controller.setAddMenuOpen(false);
    setCreateFolderDialogOpen(true);
  }

  function selectAssetType(node: LibraryNode, type: AssetSourceType) {
    controller.setContextMenu(null);

    if (type === "image-upload") {
      replaceTargetRef.current = node;
      replaceFileInputRef.current?.click();
      return;
    }

    if (type === "web-link") {
      setUrlReplacementTarget(node);
      controller.setUrlDialogOpen(true);
      return;
    }

    if (type === "asset-link") {
      setLinkReplacementTarget(node);
      controller.setLinkPickerOpen(true);
    }
  }

  const canLocateActiveTarget =
    controller.activeSectionId === "encounters"
      ? Boolean(persistence.activeRecord)
      : Boolean(getActiveBackgroundNode());
  const activeTargetLabel =
    controller.activeSectionId === "encounters"
      ? "Locate active encounter"
      : "Locate active background";
  const selectedLibraryImage =
    controller.selectedNode &&
    (controller.selectedNode.type === "image" ||
      controller.selectedNode.type === "link")
      ? controller.selectedNode
      : null;
  const selectedEncounter =
    controller.activeSectionId === "encounters"
      ? persistence.encounters.find(
          (record) => record.id === controller.selectedNodeId
        )
      : null;

  function createActorFromSelectedToken() {
    if (controller.activeSectionId !== "tokens" || !selectedLibraryImage) {
      return;
    }

    onTokenDoubleClick(selectedLibraryImage);
    onClose();
  }

  function setSelectedBackground() {
    if (controller.activeSectionId !== "backgrounds" || !selectedLibraryImage) {
      return;
    }

    if (!resolveLibraryAsset(controller.activeSection, selectedLibraryImage.id)) {
      return;
    }

    onBackgroundDoubleClick(selectedLibraryImage);
    onClose();
  }

  return (
    <div
      aria-label="Asset Library"
      aria-modal="true"
      className="viewport-overlay z-50 flex items-center justify-center bg-black/40 p-2 lg:p-6"
      role="dialog"
    >
      <div className="flex h-full max-h-[44rem] w-full max-w-[68rem] flex-col overflow-hidden rounded-2xl border border-canvas-line bg-canvas-panel shadow-2xl lg:rounded-3xl">
        <header className="flex items-center justify-between border-b border-canvas-line px-3 py-3 lg:px-5 lg:py-4">
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
        <div className="scrollbar-hidden flex shrink-0 overflow-x-auto border-b border-canvas-line px-3 pt-3 lg:px-5" role="tablist">
          {(encounterOnly ? (["encounters"] as const) : LIBRARY_SECTION_IDS).map((sectionId) => (
            <button
              key={sectionId}
              aria-selected={controller.activeSectionId === sectionId}
              className={`shrink-0 rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
                controller.activeSectionId === sectionId
                  ? "border-canvas-line bg-white text-canvas-ink"
                  : "border-transparent text-canvas-muted hover:bg-canvas"
              }`}
              onClick={() => {
                controller.setActiveSectionId(sectionId);
                controller.setContextMenu(null);
                setFocusedEncounterId(null);
                setFocusedFolderId(null);
                setFocusedNodeId(null);
              }}
              role="tab"
              type="button"
            >
              {LIBRARY_SECTION_LABELS[sectionId]}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(11rem,40%)_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-1">
          <aside className="min-h-0 overflow-hidden border-b border-canvas-line p-3 lg:border-b-0 lg:border-r lg:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {controller.activeSection.name}
              </h3>
              <div className="flex items-center gap-2">
                {controller.activeSectionId === "encounters" ||
                controller.activeSectionId === "backgrounds" ? (
                  <button
                    aria-label={activeTargetLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas disabled:cursor-not-allowed disabled:text-canvas-muted"
                    disabled={!canLocateActiveTarget}
                    onClick={
                      controller.activeSectionId === "encounters"
                        ? locateActiveEncounter
                        : locateActiveBackground
                    }
                    title={activeTargetLabel}
                    type="button"
                  >
                    <Target aria-hidden="true" className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  aria-label="Locate current directory"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-canvas-line bg-white text-canvas-ink transition hover:bg-canvas"
                  onClick={locateCurrentFolder}
                  title="Locate current directory"
                  type="button"
                >
                  <Crosshair aria-hidden="true" className="h-4 w-4" />
                </button>
                {!persistence.readOnly ? <AssetLibraryAddMenu
                  addMenuOpen={controller.addMenuOpen}
                  addMenuRef={controller.addMenuRef}
                  canLinkAssets={controller.imageNodes.length > 0}
                  canUploadAssets={controller.activeSectionId !== "encounters"}
                  canUseGoogleDrive={controller.canUseGoogleDrive && controller.activeSectionId !== "encounters"}
                  encounterSection={controller.activeSectionId === "encounters"}
                  onCreateEncounter={() => {
                    controller.setAddMenuOpen(false);
                    onCreateEncounter?.();
                  }}
                  onCreateFolder={openCreateFolderDialog}
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
                  onOpenGoogleDrive={() => void controller.createGoogleDriveAssets()}
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
            </div>
            <AssetLibraryExplorer
              activeSection={controller.activeSection}
              currentFolderId={controller.currentFolder.id}
              dropFolderId={controller.dropFolderId}
              encounterRecords={persistence.encounters}
              expandedFolderIds={controller.expandedFolderIds}
              onDragOverFolder={(event, node) => {
                if (!handleEncounterDragOver(event, node.id)) {
                  controller.handleDragOverFolder(event, node);
                }
              }}
              onPointerDownNode={startPointerDrag}
              onDoubleClickNode={handleDoubleClick}
              onFolderFocused={() => setFocusedFolderId(null)}
              onDropOnFolder={(event, node) => {
                if (!handleEncounterDrop(event, node.id)) {
                  controller.handleDropOnFolder(event, node);
                }
              }}
              onEnterFolder={controller.enterFolder}
              onSelectEncounter={controller.selectNode}
              onDoubleClickEncounter={loadEncounter}
              onOpenContextMenu={controller.openContextMenuForNode}
              onSearchQueryChange={controller.setSearchQuery}
              onSelectNode={controller.selectNode}
              onToggleFolder={controller.toggleFolder}
              searchQuery={controller.searchQuery}
              selectedNodeId={controller.selectedNodeId}
              setDropFolderId={controller.setDropFolderId}
              focusedFolderId={focusedFolderId}
            />
          </aside>
          <AssetLibraryContents
            activeSection={controller.activeSection}
            currentFolder={controller.currentFolder}
            dropFolderId={controller.dropFolderId}
            viewMode={controller.viewMode}
            onViewModeChange={controller.setViewMode}
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
                cloud ? cloud.prepareEncounterExport(envelope) : envelope
              ).then((envelope) =>
                downloadExport(
                  envelope,
                  `${name.trim().replace(/[^a-z0-9_-]+/gi, "-") || "encounter"}.json`
                )
              );
            }}
            onLoadEncounter={(id) => {
              loadEncounter(id);
            }}
            onRequestRenameEncounter={(id, name) =>
              setRenameTarget({ kind: "encounter", id, name })
            }
            readOnly={persistence.readOnly}
            recentEncounterIds={(cloud?.recentEncounters ?? []).map(({ encounterId }) => encounterId)}
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
            onPointerDownNode={startPointerDrag}
            onDoubleClickNode={handleDoubleClick}
            onEncounterFocused={() => setFocusedEncounterId(null)}
            onNodeFocused={() => setFocusedNodeId(null)}
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
            focusedEncounterId={focusedEncounterId}
            focusedNodeId={focusedNodeId}
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
        ) : controller.activeSectionId === "tokens" ? (
          <footer className="flex justify-end border-t border-canvas-line px-5 py-3">
            <button
              className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={persistence.readOnly || !selectedLibraryImage}
              onClick={createActorFromSelectedToken}
              type="button"
            >
              {tokenSubmitLabel}
            </button>
          </footer>
        ) : controller.activeSectionId === "backgrounds" ? (
          <footer className="flex justify-end border-t border-canvas-line px-5 py-3">
            <button
              className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={persistence.readOnly || !selectedLibraryImage}
              onClick={setSelectedBackground}
              type="button"
            >
              Set Background
            </button>
          </footer>
        ) : controller.activeSectionId === "encounters" ? (
          <footer className="flex justify-end border-t border-canvas-line px-5 py-3">
            <button
              className="rounded-xl bg-canvas-ink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedEncounter}
              onClick={() => {
                if (selectedEncounter) {
                  loadEncounter(selectedEncounter.id);
                }
              }}
              type="button"
            >
              Open Encounter
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
        ref={replaceFileInputRef}
        accept="image/*"
        aria-label="Replace library image"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const node = replaceTargetRef.current;
          replaceTargetRef.current = null;
          if (file && node) {
            void controller.replaceNodeWithFile(node, file);
          }
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
          canLinkAssets={controller.imageNodes.some(
            (candidate) => candidate.id !== controller.contextNode?.id
          )}
          contextMenu={controller.contextMenu}
          contextMenuRef={controller.contextMenuRef}
          node={controller.contextNode}
          onSelectAssetType={selectAssetType}
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
          ariaLabel={linkReplacementTarget ? "Select asset link target" : undefined}
          imageNodes={controller.imageNodes.filter(
            (node) => node.id !== linkReplacementTarget?.id
          )}
          onClose={() => {
            setLinkReplacementTarget(null);
            controller.setLinkPickerOpen(false);
          }}
          onSelectAsset={(target) => {
            if (linkReplacementTarget) {
              controller.replaceNodeWithAssetLink(linkReplacementTarget, target);
              setLinkReplacementTarget(null);
              controller.setLinkPickerOpen(false);
              return;
            }

            controller.createLinkToAsset(target);
          }}
          title={linkReplacementTarget ? "Select asset link target" : undefined}
        />
      ) : null}
      {controller.urlDialogOpen ? (
        <WebImageUrlDialog
          description="The library will keep a reference to this URL; the image file will not be copied into the library."
          onClose={() => {
            setUrlReplacementTarget(null);
            controller.setUrlDialogOpen(false);
          }}
          onSubmit={(url, name) => {
            if (urlReplacementTarget) {
              controller.replaceNodeWithUrl(urlReplacementTarget, url, name);
              setUrlReplacementTarget(null);
              controller.setUrlDialogOpen(false);
              return;
            }

            controller.createUrlAsset(url, name);
          }}
          title="Link image URL"
          showName={!urlReplacementTarget}
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
      {createFolderDialogOpen ? (
        <RenameModal
          ariaLabel="Create folder"
          inputLabel="Folder name"
          onClose={() => setCreateFolderDialogOpen(false)}
          onRename={controller.createFolderInSelection}
          submitLabel="Create folder"
          title="Create folder"
        />
      ) : null}
      {pointerDragPreview ? (
        <LibraryPointerDragPreview preview={pointerDragPreview} />
      ) : null}
    </div>
  );
}
