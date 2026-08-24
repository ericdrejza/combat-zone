import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setActiveTool } from "@interaction/interactionState";
import { MVP_TOOLS } from "@interaction/tools/toolRegistry";
import type { ToolId } from "@interaction/tools/toolRegistry";
import { CanvasShell } from "./canvas/CanvasShell";
import { CanvasViewportProvider } from "./canvas/CanvasViewportContext";
import type { DockPanelDefinition, DockSide, DropTarget } from "./panels/PanelsShell";
import { LibraryPanel, LibraryPanelViewToggle } from "./panels/LibraryPanel";
import { LogPanel, LogPanelHeaderActions } from "./panels/LogPanel";
import { InitiativePanel } from "./panels/InitiativePanel";
import type {
  LibraryPanelFocusRequest,
  LibraryViewMode
} from "./panels/LibraryPanel";
import { movePanel } from "./panels/panelLayout";
import type { PanelLayout } from "./panels/panelLayout";
import { PanelsShell } from "./panels/PanelsShell";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { SidebarDock } from "./panels/SidebarDock";
import { ZonePropertiesHeaderActions } from "./panels/ZonePropertiesPanel";
import { Toolbar } from "./toolbar/Toolbar";
import type { RootState } from "@store/store";
import { commitEncounterChange } from "@store/encounterSlice";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import { ActorRenameModal } from "./toolbar/actor/ActorRenameModal";
import { ZoneResizeApprovalProvider } from "./zoneResizeApproval";
import { MotionPreferenceProvider } from "./motion_preferences/MotionPreferenceProvider";
import { readImageAssetDimensions } from "./toolbar/background/readImageFile";
import { commitBackgroundImage } from "./toolbar/background/backgroundCanvasActions";
import { useCanvasViewport } from "./canvas/CanvasViewportContext";
import { SettingsButton } from "./settings/SettingsButton";
import { useAppPersistenceUi } from "./persistence/useAppPersistenceUi";

type SidebarCollapsedState = Record<DockSide, boolean>;

const initialPanelLayout: PanelLayout = {
  left: [
    { id: "library", title: "Library", collapsed: false },
    { id: "properties", title: "Properties", collapsed: false },
    { id: "log", title: "Log", collapsed: false }
  ],
  right: [
    { id: "initiative", title: "Initiative", collapsed: false },
    {
      id: "status",
      title: "Status",
      description: "Entity detail scaffold.",
      collapsed: false
    },
  ]
};

const toolShortcutMap = Object.fromEntries(
  MVP_TOOLS.map((tool) => [tool.contract.keyboardShortcut.toLowerCase(), tool.id])
) as Record<string, ToolId>;

function shouldIgnoreKeyboardShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

function AppContent() {
  const dispatch = useDispatch();
  const { getViewportSize, zoom: viewportZoom } = useCanvasViewport();
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(initialPanelLayout);
  const [libraryAutoCollapsedBySelect, setLibraryAutoCollapsedBySelect] =
    useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState<SidebarCollapsedState>({
      left: false,
      right: false
    });
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [libraryFocusRequest, setLibraryFocusRequest] =
    useState<LibraryPanelFocusRequest | null>(null);
  const [libraryViewMode, setLibraryViewMode] =
    useState<LibraryViewMode>("list");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const persistenceUi = useAppPersistenceUi({
    onBackgroundDoubleClick: applyBackgroundFromLibrary,
    onTokenDoubleClick: focusTokenInLibrary
  });
  const workspaceColumns = `${
    sidebarCollapsed.left ? "3.25rem" : "18rem"
  } minmax(0,1fr) ${sidebarCollapsed.right ? "3.25rem" : "18rem"}`;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void persistenceUi.requestSave();
        return;
      }

      if (shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const shortcut = event.key.toLowerCase();

      if (
        shortcut === "r" &&
        selection.selectedEntityType === "actor" &&
        selection.selectedIds.length > 0
      ) {
        event.preventDefault();
        setRenameModalOpen(true);
        return;
      }

      const nextToolId = toolShortcutMap[shortcut];

      if (!nextToolId) {
        return;
      }

      event.preventDefault();
      dispatch(setActiveTool(nextToolId));
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, selection, persistenceUi]);

  function mapLibraryPanel(
    layout: PanelLayout,
    mapper: (panel: DockPanelDefinition) => DockPanelDefinition
  ): PanelLayout {
    return {
      left: layout.left.map((panel) =>
        panel.id === "library" ? mapper(panel) : panel
      ),
      right: layout.right.map((panel) =>
        panel.id === "library" ? mapper(panel) : panel
      )
    };
  }

  useEffect(() => {
    if (activeToolId !== "select") {
      return;
    }

    setPanelLayout((layout) => {
      let collapsedOpenLibraryPanel = false;

      const nextLayout = mapLibraryPanel(layout, (panel) => {
        if (panel.collapsed) {
          return panel;
        }

        collapsedOpenLibraryPanel = true;
        return { ...panel, collapsed: true };
      });

      setLibraryAutoCollapsedBySelect(collapsedOpenLibraryPanel);
      return nextLayout;
    });
  }, [activeToolId]);

  function expandAutoCollapsedLibraryPanel() {
    if (!libraryAutoCollapsedBySelect) {
      return;
    }

    setPanelLayout((layout) =>
      mapLibraryPanel(layout, (panel) => ({ ...panel, collapsed: false }))
    );
    setLibraryAutoCollapsedBySelect(false);
  }

  function focusTokenInLibrary(node: LibraryNode) {
    const tokens = library.sections.tokens;

    setLibraryFocusRequest({
      folderId: node.parentId ?? tokens.rootId,
      nodeId: node.id,
      sectionId: "tokens"
    });
    setPanelLayout((layout) =>
      mapLibraryPanel(layout, (panel) => ({ ...panel, collapsed: false }))
    );
    setLibraryAutoCollapsedBySelect(false);
    dispatch(setActiveTool("actor"));
  }

  function applyBackgroundFromLibrary(node: LibraryNode) {
    const backgrounds = library.sections.backgrounds;
    const asset = resolveLibraryAsset(backgrounds, node.id);

    if (!asset) {
      return;
    }

    const commitImage = (backgroundImage: Awaited<ReturnType<typeof readImageAssetDimensions>>) =>
      commitBackgroundImage({
        backgroundImage: { ...backgroundImage, libraryNodeId: node.id },
        dispatch,
        encounter,
        viewportSize: getViewportSize(),
        viewportZoom
      });

    if (asset.width && asset.height) {
      commitImage({ ...asset, height: asset.height, width: asset.width });
    } else {
      void readImageAssetDimensions(asset).then(commitImage);
    }
  }

  function handlePanelDrop(target: DropTarget) {
    if (!draggedPanelId) {
      return;
    }

    setPanelLayout((layout) => movePanel(layout, draggedPanelId, target));
    setDraggedPanelId(null);
    setDropTarget(null);
  }

  function handlePanelCollapsedChange(panelId: string, collapsed: boolean) {
    if (panelId === "library") {
      setLibraryAutoCollapsedBySelect(false);
    }

    setPanelLayout((layout) => ({
      left: layout.left.map((panel) =>
        panel.id === panelId ? { ...panel, collapsed } : panel
      ),
      right: layout.right.map((panel) =>
        panel.id === panelId ? { ...panel, collapsed } : panel
      )
    }));
  }

  function renderPanelContent(panel: DockPanelDefinition) {
    if (panel.id === "library") {
      return (
        <LibraryPanel
          focusRequest={libraryFocusRequest}
          onFocusRequestHandled={() => setLibraryFocusRequest(null)}
          viewMode={libraryViewMode}
        />
      );
    }

    if (panel.id === "properties") {
      return <PropertiesPanel />;
    }

    if (panel.id === "log") {
      return <LogPanel />;
    }

    if (panel.id === "initiative") {
      return <InitiativePanel />;
    }

    return undefined;
  }

  function renderPanelHeaderActions(panel: DockPanelDefinition) {
    if (panel.id === "library") {
      return (
        <LibraryPanelViewToggle
          onToggle={() =>
            setLibraryViewMode((mode) => (mode === "list" ? "grid" : "list"))
          }
          viewMode={libraryViewMode}
        />
      );
    }

    if (panel.id === "properties") {
      return <ZonePropertiesHeaderActions />;
    }

    if (panel.id === "log") {
      return <LogPanelHeaderActions />;
    }

    return undefined;
  }

  return (
    <MotionPreferenceProvider>
      <ZoneResizeApprovalProvider>
        <div className="flex h-screen max-h-screen w-screen max-w-screen flex-col overflow-hidden bg-canvas text-canvas-ink">
      <Toolbar
        onActorToolSelected={expandAutoCollapsedLibraryPanel}
        onOpenLibrary={persistenceUi.openLibrary}
        onSaveEncounter={() => void persistenceUi.requestSave()}
        persistenceReadOnly={persistenceUi.readOnly}
        saveStatus={persistenceUi.saveStatus}
      />
      <main
        className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[var(--workspace-columns)]"
        style={
          {
            "--workspace-columns": workspaceColumns
          } as CSSProperties
        }
      >
        <SidebarDock
          collapsed={sidebarCollapsed.left}
          footer={<SettingsButton onClick={persistenceUi.openSettings} />}
          onToggle={() =>
            setSidebarCollapsed((current) => ({
              ...current,
              left: !current.left
            }))
          }
          side="left"
        >
          <PanelsShell
            draggedPanelId={draggedPanelId}
            dropTarget={dropTarget}
            onDragEnd={() => {
              setDraggedPanelId(null);
              setDropTarget(null);
            }}
            onDragStart={setDraggedPanelId}
            onPanelCollapsedChange={handlePanelCollapsedChange}
            onDropPanel={handlePanelDrop}
            onPreviewDrop={setDropTarget}
            panels={panelLayout.left}
            renderPanelHeaderActions={renderPanelHeaderActions}
            renderPanelContent={renderPanelContent}
            side="left"
          />
        </SidebarDock>
        <CanvasShell />
        <SidebarDock
          collapsed={sidebarCollapsed.right}
          onToggle={() =>
            setSidebarCollapsed((current) => ({
              ...current,
              right: !current.right
            }))
          }
          side="right"
        >
          <PanelsShell
            draggedPanelId={draggedPanelId}
            dropTarget={dropTarget}
            onDragEnd={() => {
              setDraggedPanelId(null);
              setDropTarget(null);
            }}
            onDragStart={setDraggedPanelId}
            onPanelCollapsedChange={handlePanelCollapsedChange}
            onDropPanel={handlePanelDrop}
            onPreviewDrop={setDropTarget}
            panels={panelLayout.right}
            renderPanelHeaderActions={renderPanelHeaderActions}
            renderPanelContent={renderPanelContent}
            side="right"
          />
        </SidebarDock>
      </main>
      {persistenceUi.dialogs}
      {renameModalOpen ? (
        <ActorRenameModal onClose={() => setRenameModalOpen(false)} />
      ) : null}
        </div>
      </ZoneResizeApprovalProvider>
    </MotionPreferenceProvider>
  );
}

export function App() {
  return (
    <CanvasViewportProvider>
      <AppContent />
    </CanvasViewportProvider>
  );
}
