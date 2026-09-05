import type { ChangeEvent, DragEvent } from "react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import {
  createFolder,
  createLink,
  deleteNode,
  moveNode,
  replaceImage,
  replaceWithAssetLink,
  renameNode,
  uploadImage
} from "@library/librarySlice";
import type { LibraryNode, LibrarySectionId } from "@library/types";
import { resolveLibraryAsset } from "@library/librarySlice";
import { createWebImageAsset } from "@library/webImageAsset";
import type { RootState } from "@store/store";
import { createImageFilesInFolder } from "./assetLibraryUpload";
import { readImageFile } from "@ui/toolbar/background/readImageFile";
import {
  hasExternalFiles,
  hasInternalLibraryNode,
  LIBRARY_NODE_DRAG_TYPE
} from "./libraryDrag";
import { getDroppedImageFiles, getFileRelativePath } from "./libraryFileDrop";
import {
  useAssetLibraryModalState,
  type LibraryFolderBySection,
  type LibraryViewModeBySection
} from "./useAssetLibraryModalState";
import type { AssetLibraryViewMode } from "./assetLibraryView";
import { useOptionalCloudSync } from "@ui/cloud_sync";
import { syncLibraryAssetReferences } from "./libraryReferenceSync";

const toDroppedFiles = (files: File[]) =>
  files.map((file) => ({ file, relativePath: getFileRelativePath(file) }));

type AssetLibraryModalControllerOptions = {
  currentFolderBySection: LibraryFolderBySection;
  initialSectionId?: LibrarySectionId;
  onCurrentFolderChange: (sectionId: keyof LibraryFolderBySection, folderId: string) => void;
  onViewModeChange: (sectionId: keyof LibraryViewModeBySection, viewMode: AssetLibraryViewMode) => void;
  viewModeBySection: LibraryViewModeBySection;
};

export function useAssetLibraryModalController({
  currentFolderBySection,
  initialSectionId,
  onCurrentFolderChange,
  onViewModeChange,
  viewModeBySection
}: AssetLibraryModalControllerOptions) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const cloud = useOptionalCloudSync();
  const state = useAssetLibraryModalState({
    currentFolderBySection,
    initialSectionId,
    onCurrentFolderChange,
    onViewModeChange,
    viewModeBySection
  });
  const {
    activeSection,
    activeSectionId,
    addMenuOpen,
    addMenuRef,
    clearDragState,
    contextMenu,
    contextMenuRef,
    currentFolder,
    draggedNodeId,
    pendingDeleteNode,
    selectedNode,
    selectNode,
    setAddMenuOpen,
    setContextMenu,
    setDropFolderId,
    setLinkPickerOpen,
    setPendingDeleteNodeId,
    setSelectedNodeBySection
  } = state;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (addMenuOpen && !addMenuRef.current?.contains(target)) {
        setAddMenuOpen(false);
      }

      if (contextMenu && !contextMenuRef.current?.contains(target)) {
        setContextMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [addMenuOpen, contextMenu]);

  function getAddParentId() {
    if (!selectedNode) {
      return activeSection.rootId;
    }

    return selectedNode.type === "folder"
      ? selectedNode.id
      : selectedNode.parentId ?? activeSection.rootId;
  }

  function getDraggedLibraryNodeId(event: DragEvent<HTMLElement>) {
    return (
      event.dataTransfer.getData(LIBRARY_NODE_DRAG_TYPE) ||
      event.dataTransfer.getData("text/plain") ||
      draggedNodeId
    );
  }

  function moveLibraryNodeToFolder(
    event: DragEvent<HTMLElement>,
    targetFolderId: string
  ) {
    // An internal drop is owned by the library even when it resolves to a
    // no-op. Cancelling the browser default also prevents the text/plain
    // fallback payload from being handled as a native text/URL drop.
    event.preventDefault();
    event.stopPropagation();
    const nodeId = getDraggedLibraryNodeId(event);

    if (nodeId) {
      moveLibraryNodeToFolderById(nodeId, targetFolderId);
    } else {
      clearDragState();
    }
  }

  function moveLibraryNodeToFolderById(
    nodeId: string,
    targetFolderId: string
  ) {
    const node = nodeId ? activeSection.nodesById[nodeId] : null;

    if (
      !node ||
      node.id === activeSection.rootId ||
      node.id === targetFolderId ||
      node.parentId === targetFolderId
    ) {
      clearDragState();
      return;
    }

    dispatch(moveNode({ nodeId: node.id, sectionId: activeSectionId, targetFolderId }));
    clearDragState();
  }

  async function uploadDroppedItems(
    event: DragEvent<HTMLElement>,
    parentId: string
  ) {
    if (activeSectionId === "encounters" || !hasExternalFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    await createImageFilesInFolder({
      dispatch,
      files: await getDroppedImageFiles(event.dataTransfer),
      rootParentId: parentId,
      sectionId: activeSectionId
    });
    setDropFolderId(null);
  }

  function handleDragOverFolder(event: DragEvent<HTMLElement>, node: LibraryNode) {
    if (hasInternalLibraryNode(event) || (draggedNodeId && draggedNodeId !== node.id)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDropFolderId(node.id);
      return;
    }

    if (hasExternalFiles(event)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect =
        activeSectionId === "encounters" ? "none" : "copy";
      setDropFolderId(node.id);
    }
  }

  function handleDropOnFolder(event: DragEvent<HTMLElement>, node: LibraryNode) {
    if (hasInternalLibraryNode(event) || draggedNodeId) {
      moveLibraryNodeToFolder(event, node.id);
      return;
    }

    if (hasExternalFiles(event)) {
      void uploadDroppedItems(event, node.id);
    }
  }

  function handleDragOverContents(event: DragEvent<HTMLElement>) {
    if (hasInternalLibraryNode(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropFolderId(currentFolder.id);
      return;
    }

    if (hasExternalFiles(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect =
        activeSectionId === "encounters" ? "none" : "copy";
      setDropFolderId(currentFolder.id);
    }
  }

  function handleDropOnContents(event: DragEvent<HTMLElement>) {
    if (hasInternalLibraryNode(event) || draggedNodeId) {
      moveLibraryNodeToFolder(event, currentFolder.id);
      return;
    }

    void uploadDroppedItems(event, currentFolder.id);
  }

  function openContextMenuForNode(
    event: { clientX: number; clientY: number; preventDefault: () => void },
    node: LibraryNode
  ) {
    if (node.id === activeSection.rootId) {
      return;
    }

    event.preventDefault();
    selectNode(node.id);
    setContextMenu({ nodeId: node.id, x: event.clientX, y: event.clientY });
  }

  function createFolderInSelection(name: string) {
    dispatch(createFolder({
      name,
      parentId: getAddParentId(),
      sectionId: activeSectionId
    }));
    setAddMenuOpen(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const parentId = getAddParentId();
    event.target.value = "";
    if (files.length === 0) {
      return;
    }
    await createImageFilesInFolder({
      dispatch,
      files: toDroppedFiles(files),
      rootParentId: parentId,
      sectionId: activeSectionId
    });
    setAddMenuOpen(false);
  }

  async function handleFolderChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    await createImageFilesInFolder({
      dispatch,
      files: toDroppedFiles(files),
      rootParentId: getAddParentId(),
      sectionId: activeSectionId
    });
    setAddMenuOpen(false);
  }

  function renameLibraryNode(node: LibraryNode, name: string) {
    dispatch(renameNode({ name, nodeId: node.id, sectionId: activeSectionId }));
    setContextMenu(null);
  }

  function handleDelete(node: LibraryNode) {
    if (node.type === "folder" && (node.childIds?.length ?? 0) > 0) {
      setPendingDeleteNodeId(node.id);
      setContextMenu(null);
      return;
    }

    dispatch(deleteNode({ nodeId: node.id, sectionId: activeSectionId }));
    setContextMenu(null);
  }

  function confirmDeletePendingFolder() {
    if (!pendingDeleteNode) {
      return;
    }
    dispatch(deleteNode({ nodeId: pendingDeleteNode.id, sectionId: activeSectionId }));
    setPendingDeleteNodeId(null);
    setSelectedNodeBySection((current) => {
      const next = { ...current };

      if (next[activeSectionId] === pendingDeleteNode.id) {
        delete next[activeSectionId];
      }

      return next;
    });
  }

  function createLinkToAsset(node: LibraryNode) {
    dispatch(createLink({
      parentId: getAddParentId(),
      sectionId: activeSectionId,
      targetId: node.id
    }));
    setLinkPickerOpen(false);
  }

  async function replaceNodeWithFile(node: LibraryNode, file: File) {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const asset = await readImageFile(file);
    dispatch(replaceImage({
      asset,
      name: node.name,
      nodeId: node.id,
      sectionId: activeSectionId
    }));
    syncLibraryAssetReferences({
      asset: { ...asset, name: node.name },
      dispatch,
      encounter,
      nodeId: node.id,
      section: activeSection
    });
  }

  function replaceNodeWithUrl(node: LibraryNode, url: string, name?: string) {
    const asset = createWebImageAsset(url);
    const nextAsset = {
      ...asset,
      name: name?.trim() || node.name
    };

    dispatch(replaceImage({
      asset,
      name: nextAsset.name,
      nodeId: node.id,
      sectionId: activeSectionId
    }));
    syncLibraryAssetReferences({
      asset: nextAsset,
      dispatch,
      encounter,
      nodeId: node.id,
      section: activeSection
    });
  }

  function replaceNodeWithAssetLink(node: LibraryNode, target: LibraryNode) {
    const asset = resolveLibraryAsset(activeSection, target.id);

    if (!asset) {
      return;
    }

    dispatch(replaceWithAssetLink({
      nodeId: node.id,
      sectionId: activeSectionId,
      targetId: target.id
    }));
    syncLibraryAssetReferences({
      asset,
      dispatch,
      encounter,
      nodeId: node.id,
      section: activeSection
    });
  }

  function createUrlAsset(url: string, name?: string) {
    const asset = createWebImageAsset(url);

    dispatch(uploadImage({
      asset: name?.trim() ? { ...asset, name: name.trim() } : asset,
      parentId: getAddParentId(),
      sectionId: activeSectionId
    }));
    setAddMenuOpen(false);
    state.setUrlDialogOpen(false);
  }

  async function createGoogleDriveAssets() {
    if (!cloud || activeSectionId === "encounters") return;
    try {
      const assets = await cloud.linkDriveImages();
      for (const asset of assets) {
        dispatch(uploadImage({ asset, parentId: getAddParentId(), sectionId: activeSectionId }));
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Google Drive could not be opened.");
    } finally {
      setAddMenuOpen(false);
    }
  }

  return {
    ...state,
    createFolderInSelection,
    createLinkToAsset,
    createGoogleDriveAssets,
    createUrlAsset,
    confirmDeletePendingFolder,
    handleDelete,
    handleDragOverContents,
    handleDragOverFolder,
    handleDropOnContents,
    handleDropOnFolder,
    handleFileChange,
    handleFolderChange,
    renameLibraryNode,
    replaceNodeWithAssetLink,
    replaceNodeWithFile,
    replaceNodeWithUrl,
    moveLibraryNodeToFolderById,
    canUseGoogleDrive: Boolean(cloud?.user),
    openContextMenuForNode
  };
}
