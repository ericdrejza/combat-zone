import { useRef, useState } from "react";
import { useSelector } from "react-redux";

import type { LibrarySectionId } from "@library/types";
import { LIBRARY_SECTION_IDS } from "@library/types";
import type { RootState } from "@store/store";
import type { ContextMenuState } from "./AssetLibraryMenus";
import { getImageNodes } from "./libraryUi";

export function useAssetLibraryModalState() {
  const library = useSelector((state: RootState) => state.library);
  const [activeSectionId, setActiveSectionId] =
    useState<LibrarySectionId>("encounters");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(LIBRARY_SECTION_IDS.map((sectionId) => `${sectionId}-root`))
  );
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderBySection, setCurrentFolderBySection] = useState<
    Partial<Record<LibrarySectionId, string>>
  >({});
  const [selectedNodeBySection, setSelectedNodeBySection] = useState<
    Partial<Record<LibrarySectionId, string>>
  >({});
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const activeSection = library.sections[activeSectionId];
  const selectedNodeId = selectedNodeBySection[activeSectionId];
  const selectedNode = selectedNodeId
    ? activeSection.nodesById[selectedNodeId]
    : null;
  const currentFolderId = currentFolderBySection[activeSectionId]
    ? activeSection.nodesById[currentFolderBySection[activeSectionId] as string]
      ? currentFolderBySection[activeSectionId]
      : activeSection.rootId
    : activeSection.rootId;
  const currentFolder =
    activeSection.nodesById[currentFolderId] ??
    activeSection.nodesById[activeSection.rootId];
  const contextNode = contextMenu
    ? activeSection.nodesById[contextMenu.nodeId]
    : null;
  const pendingDeleteNode = pendingDeleteNodeId
    ? activeSection.nodesById[pendingDeleteNodeId]
    : null;

  function selectNode(nodeId: string) {
    setSelectedNodeBySection((current) => ({
      ...current,
      [activeSectionId]: nodeId
    }));
  }

  function enterFolder(folderId: string) {
    setCurrentFolderBySection((current) => ({
      ...current,
      [activeSectionId]: folderId
    }));
    selectNode(folderId);
  }

  function clearDragState() {
    setDraggedNodeId(null);
    setDropFolderId(null);
  }

  function toggleFolder(folderId: string) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }

      return next;
    });
  }

  return {
    activeSection,
    activeSectionId,
    addMenuOpen,
    addMenuRef,
    clearDragState,
    contextMenu,
    contextMenuRef,
    contextNode,
    currentFolder,
    draggedNodeId,
    dropFolderId,
    enterFolder,
    expandedFolderIds,
    fileInputRef,
    folderInputRef,
    imageNodes: getImageNodes(activeSection),
    linkPickerOpen,
    pendingDeleteNode,
    searchQuery,
    selectNode,
    selectedNode,
    selectedNodeId: selectedNode?.id,
    setActiveSectionId,
    setAddMenuOpen,
    setContextMenu,
    setDropFolderId,
    setDraggedNodeId,
    setLinkPickerOpen,
    setPendingDeleteNodeId,
    setSearchQuery,
    setSelectedNodeBySection,
    setUrlDialogOpen,
    toggleFolder,
    urlDialogOpen
  };
}
