import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { setActiveTool } from "@interaction/interactionState";
import { MVP_TOOLS } from "@interaction/tools/toolRegistry";
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
import type { ActorImageInput } from "@entities/actor/actorMutations";
import { ActorRenameModal } from "./toolbar/actor/ActorRenameModal";
import { ZoneResizeApprovalProvider } from "./zoneResizeApproval";
import { MotionPreferenceProvider } from "./motion_preferences/MotionPreferenceProvider";
import { readImageAssetDimensions } from "./toolbar/background/readImageFile";
import { commitBackgroundImage } from "./toolbar/background/backgroundCanvasActions";
import { useCanvasViewport } from "./canvas/CanvasViewportContext";
import { useCompactLayout } from "@hooks/useCompactLayout";
import type {
  CompactPanelDefinition
} from "./panels/compactPanelMetadata";
import { CompactZonelessActorPanel } from "./panels/zoneless_actors/CompactZonelessActorPanel";
import { EncounterRenameDialog } from "./encounter/EncounterRenameDialog";
import { TouchTooltipProvider } from "./toolbar/TouchTooltip";
import { useVisualViewportRect } from "@hooks/useVisualViewportRect";
import { SettingsButton } from "./settings/SettingsButton";
import { useAppPersistenceUi } from "./persistence/useAppPersistenceUi";
import { useOptionalCloudSync } from "./cloud_sync";
import {
  applyActorTokenFromLibrary as commitActorTokenFromLibrary
} from "./panels/actorTokenImageChange";
import {
  KeybindProvider,
  matchesKeybind,
  useKeybinds,
  type KeybindActionId
} from "./keybinds";
import { ThemeProvider } from "./theme/ThemeProvider";

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

const toolKeybindActions = Object.fromEntries(
  MVP_TOOLS.map((tool) => [tool.id, `tool.${tool.id}`])
) as Record<(typeof MVP_TOOLS)[number]["id"], KeybindActionId>;

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
  const cloud = useOptionalCloudSync();
  const dispatch = useDispatch();
  const { bindings } = useKeybinds();
  const { getViewportSize, zoom: viewportZoom } = useCanvasViewport();
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const compactLayout = useCompactLayout();
  const visualViewport = useVisualViewportRect();
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
  const [actorCreationImage, setActorCreationImage] =
    useState<ActorImageInput | null>(null);
  const [libraryViewMode, setLibraryViewMode] =
    useState<LibraryViewMode>("list");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [encounterRenameOpen, setEncounterRenameOpen] = useState(false);
  const persistenceUi = useAppPersistenceUi({
    onActorTokenSelect: applyActorTokenFromLibrary,
    onBackgroundDoubleClick: applyBackgroundFromLibrary,
    onTokenDoubleClick: focusTokenInLibrary
  });
  const workspaceColumns = `${
    sidebarCollapsed.left ? "3.25rem" : "18rem"
  } minmax(0,1fr) ${sidebarCollapsed.right ? "3.25rem" : "18rem"}`;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (matchesKeybind(event, bindings["workspace.save"])) {
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

      if (
        matchesKeybind(event, bindings["actor.rename"]) &&
        selection.selectedEntityType === "actor" &&
        selection.selectedIds.length > 0
      ) {
        event.preventDefault();
        setRenameModalOpen(true);
        return;
      }

      const nextTool = MVP_TOOLS.find((tool) =>
        matchesKeybind(event, bindings[toolKeybindActions[tool.id]])
      );

      if (!nextTool) {
        return;
      }

      event.preventDefault();
      dispatch(setActiveTool(nextTool.id));
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [bindings, dispatch, selection, persistenceUi]);

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
    const asset = resolveLibraryAsset(tokens, node.id);

    if (!asset) {
      return;
    }

    setActorCreationImage({ ...asset, libraryNodeId: node.id });

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
      void readImageAssetDimensions(asset, cloud?.resolveImageAsset).then(commitImage);
    }
  }

  function applyActorTokenFromLibrary(actorId: string, node: LibraryNode) {
    commitActorTokenFromLibrary({
      actorId,
      dispatch,
      encounter,
      node,
      tokens: library.sections.tokens
    });
  }

  function handlePanelDrop(target: DropTarget, pointerPanelId?: string) {
    const panelId = pointerPanelId ?? draggedPanelId;
    if (!panelId) {
      return;
    }

    setPanelLayout((layout) => movePanel(layout, panelId, target));
    setDraggedPanelId(null);
    setDropTarget(null);
  }

  function handlePanelDropPreview(target: DropTarget) {
    setDropTarget((current) =>
      current?.side === target.side && current.index === target.index
        ? current
        : target
    );
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

  function renderPanelContent(
    panel: DockPanelDefinition | CompactPanelDefinition
  ) {
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
      return (
        <PropertiesPanel
          onOpenLibraryLocation={persistenceUi.openLibrary}
          onOpenTokenLibraryForActor={persistenceUi.openTokenLibraryForActor}
        />
      );
    }

    if (panel.id === "log") {
      return <LogPanel />;
    }

    if (panel.id === "initiative") {
      return <InitiativePanel />;
    }

    if (panel.id === "zoneless") {
      return <CompactZonelessActorPanel />;
    }

    return undefined;
  }

  function renderPanelHeaderActions(
    panel: DockPanelDefinition | CompactPanelDefinition
  ) {
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
      <TouchTooltipProvider>
        <div
          className="flex flex-col overflow-hidden bg-canvas text-canvas-ink"
          data-app-shell
          style={
            {
              "--app-viewport-height": `${visualViewport.height}px`,
              "--app-viewport-left": `${visualViewport.offsetLeft}px`,
              "--app-viewport-top": `${visualViewport.offsetTop}px`,
              "--app-viewport-width": `${visualViewport.width}px`
            } as CSSProperties
          }
        >
      <ZoneResizeApprovalProvider>
      <Toolbar
        actorCreationImage={actorCreationImage}
        encounterName={encounter.name}
        hasSavedEncounter={persistenceUi.hasSavedEncounter}
        onActorToolSelected={expandAutoCollapsedLibraryPanel}
        onActorCreationImageHandled={() => setActorCreationImage(null)}
        onOpenLibrary={() =>
          persistenceUi.openLibrary(
            activeToolId === "background"
              ? "backgrounds"
              : activeToolId === "actor"
                ? "tokens"
                : "encounters"
          )
        }
        onOpenSettings={persistenceUi.openSettings}
        onRenameEncounter={() => setEncounterRenameOpen(true)}
        onSaveEncounter={() => void persistenceUi.requestSave()}
        persistenceReadOnly={persistenceUi.readOnly}
        saveStatus={persistenceUi.saveStatus}
      />
      <main
        className="relative isolate grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[var(--workspace-columns)] lg:gap-4 lg:p-4"
        style={
          {
            "--workspace-columns": workspaceColumns
          } as CSSProperties
        }
      >
        {!compactLayout ? (
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
            onPreviewDrop={handlePanelDropPreview}
            panels={panelLayout.left}
            renderPanelHeaderActions={renderPanelHeaderActions}
            renderPanelContent={renderPanelContent}
            side="left"
          />
        </SidebarDock>
        ) : null}
        <CanvasShell
          renderCompactPanelContent={renderPanelContent}
          renderCompactPanelHeaderActions={renderPanelHeaderActions}
        />
        {!compactLayout ? (
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
            onPreviewDrop={handlePanelDropPreview}
            panels={panelLayout.right}
            renderPanelHeaderActions={renderPanelHeaderActions}
            renderPanelContent={renderPanelContent}
            side="right"
          />
        </SidebarDock>
        ) : null}
      </main>
      {persistenceUi.dialogs}
      {renameModalOpen ? (
        <ActorRenameModal onClose={() => setRenameModalOpen(false)} />
      ) : null}
      {encounterRenameOpen ? (
        <EncounterRenameDialog onClose={() => setEncounterRenameOpen(false)} />
      ) : null}
      </ZoneResizeApprovalProvider>
        </div>
      </TouchTooltipProvider>
    </MotionPreferenceProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <KeybindProvider>
        <CanvasViewportProvider>
          <AppContent />
        </CanvasViewportProvider>
      </KeybindProvider>
    </ThemeProvider>
  );
}
