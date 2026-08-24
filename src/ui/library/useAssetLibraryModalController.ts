import type { ChangeEvent, DragEvent } from "react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

import {
  createFolder,
  createLink,
  deleteNode,
  moveNode,
  renameNode,
  uploadImage
} from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { createWebImageAsset } from "@library/webImageAsset";
import { createImageFilesInFolder } from "./assetLibraryUpload";
import {
  hasExternalFiles,
  hasInternalLibraryNode,
  LIBRARY_NODE_DRAG_TYPE
} from "./libraryDrag";
import { getDroppedImageFiles, getFileRelativePath } from "./libraryFileDrop";
import { useAssetLibraryModalState } from "./useAssetLibraryModalState";

const toDroppedFiles = (files: File[]) =>
  files.map((file) => ({ file, relativePath: getFileRelativePath(file) }));

export function useAssetLibraryModalController() {
  const dispatch = useDispatch();
  const state = useAssetLibraryModalState();
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
    const nodeId = getDraggedLibraryNodeId(event);
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

    event.preventDefault();
    event.stopPropagation();
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

  function createFolderInSelection() {
    const name = window.prompt("Folder name");

    if (name) {
      dispatch(createFolder({
        name,
        parentId: getAddParentId(),
        sectionId: activeSectionId
      }));
      setAddMenuOpen(false);
    }
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

  function handleRename(node: LibraryNode) {
    const name = window.prompt("New name", node.name);
    if (name) {
      dispatch(renameNode({ name, nodeId: node.id, sectionId: activeSectionId }));
      setContextMenu(null);
    }
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

  function createUrlAsset(url: string) {
    dispatch(uploadImage({
      asset: createWebImageAsset(url),
      parentId: getAddParentId(),
      sectionId: activeSectionId
    }));
    setAddMenuOpen(false);
    state.setUrlDialogOpen(false);
  }

  return {
    ...state,
    createFolderInSelection,
    createLinkToAsset,
    createUrlAsset,
    confirmDeletePendingFolder,
    handleDelete,
    handleDragOverContents,
    handleDragOverFolder,
    handleDropOnContents,
    handleDropOnFolder,
    handleFileChange,
    handleFolderChange,
    handleRename,
    openContextMenuForNode
  };
}
