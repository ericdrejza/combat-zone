import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import type { LibrarySectionId } from "@library/types";
import type { RootState } from "@store/store";
import type { AssetLibraryViewMode } from "./assetLibraryView";
import type { ContextMenuState } from "./AssetLibraryMenus";
import { getFolderAncestorIds, getImageNodes } from "./libraryUi";

export type LibraryFolderBySection = Partial<Record<LibrarySectionId, string>>;
export type LibraryViewModeBySection = Partial<
  Record<LibrarySectionId, AssetLibraryViewMode>
>;

type AssetLibraryModalStateOptions = {
  currentFolderBySection: LibraryFolderBySection;
  initialSectionId?: LibrarySectionId;
  initialSelectedNodeId?: string;
  onViewModeChange: (
    sectionId: LibrarySectionId,
    viewMode: AssetLibraryViewMode
  ) => void;
  onCurrentFolderChange: (
    sectionId: LibrarySectionId,
    folderId: string
  ) => void;
  viewModeBySection: LibraryViewModeBySection;
};

export function useAssetLibraryModalState({
  currentFolderBySection,
  initialSectionId = "encounters",
  initialSelectedNodeId,
  onCurrentFolderChange,
  onViewModeChange,
  viewModeBySection
}: AssetLibraryModalStateOptions) {
  const library = useSelector((state: RootState) => state.library);
  function getRememberedFolderId(sectionId: LibrarySectionId) {
    const section = library.sections[sectionId];
    const rememberedFolderId = currentFolderBySection[sectionId];

    return rememberedFolderId &&
      section.nodesById[rememberedFolderId]?.type === "folder"
      ? rememberedFolderId
      : section.rootId;
  }

  function getExpandedFolderIds(sectionId: LibrarySectionId) {
    const section = library.sections[sectionId];

    return new Set(
      getFolderAncestorIds(section, getRememberedFolderId(sectionId))
    );
  }

  const [activeSectionId, setActiveSectionId] =
    useState<LibrarySectionId>(initialSectionId);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => getExpandedFolderIds(initialSectionId)
  );
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeBySection, setSelectedNodeBySection] = useState<
    Partial<Record<LibrarySectionId, string>>
  >(() => initialSelectedNodeId
    ? { [initialSectionId]: initialSelectedNodeId }
    : {});
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
    ? activeSection.nodesById[currentFolderBySection[activeSectionId] as string]?.type === "folder"
      ? currentFolderBySection[activeSectionId]
      : activeSection.rootId
    : activeSection.rootId;
  const currentFolder =
    activeSection.nodesById[currentFolderId] ??
    activeSection.nodesById[activeSection.rootId];
  const viewMode = viewModeBySection[activeSectionId] ?? "grid";
  const contextNode = contextMenu
    ? activeSection.nodesById[contextMenu.nodeId]
    : null;
  const pendingDeleteNode = pendingDeleteNodeId
    ? activeSection.nodesById[pendingDeleteNodeId]
    : null;

  function selectNode(nodeId: string) {
    const node = activeSection.nodesById[nodeId];

    if (node && node.type !== "folder") {
      const ancestorIds = getFolderAncestorIds(
        activeSection,
        node.parentId ?? activeSection.rootId
      );
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        ancestorIds.forEach((folderId) => next.add(folderId));
        return next;
      });
    }

    setSelectedNodeBySection((current) => ({
      ...current,
      [activeSectionId]: nodeId
    }));
  }

  function enterFolder(folderId: string) {
    // Folder navigation can unmount the native drag source before dragend is
    // delivered, so it must also terminate the modal's drag session.
    clearDragState();
    onCurrentFolderChange(activeSectionId, folderId);
    selectNode(folderId);
  }

  function clearDragState() {
    setDraggedNodeId(null);
    setDropFolderId(null);
  }

  useEffect(() => {
    // A source can unmount or the pointer can leave the application before its
    // React dragend handler runs. Window-level termination prevents a stale
    // drag session from capturing later library interactions.
    window.addEventListener("dragend", clearDragState);
    window.addEventListener("drop", clearDragState);

    return () => {
      window.removeEventListener("dragend", clearDragState);
      window.removeEventListener("drop", clearDragState);
    };
  }, []);

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

  function setViewMode(nextViewMode: AssetLibraryViewMode) {
    onViewModeChange(activeSectionId, nextViewMode);
  }

  function selectSection(sectionId: LibrarySectionId) {
    clearDragState();
    setActiveSectionId(sectionId);
    setExpandedFolderIds(getExpandedFolderIds(sectionId));
  }

  function expandFolders(folderIds: string[]) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);

      for (const folderId of folderIds) {
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
    expandFolders,
    expandedFolderIds,
    fileInputRef,
    folderInputRef,
    imageNodes: getImageNodes(activeSection),
    linkPickerOpen,
    pendingDeleteNode,
    searchQuery,
    selectNode,
    selectedNode,
    selectedNodeId,
    setActiveSectionId: selectSection,
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
    setViewMode,
    viewMode,
    urlDialogOpen
  };
}
