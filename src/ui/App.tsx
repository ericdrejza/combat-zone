import { LiveSceneMotionProvider } from '@ui/player_view/LiveSceneMotion';
import { PlayerSceneProvider } from '@ui/player_view/PlayerSceneSource';
import { PlayerViewProvider } from '@ui/player_view/PlayerViewProvider';
import { PlayerWorkspace } from '@ui/player_view/PlayerWorkspace';
import { FocusLightProvider } from '@ui/canvas/focus/FocusLightProvider';
import { CanvasStatusVisibilityButton } from "@ui/panels/status_panel/CanvasStatusVisibilityButton";
import { nextLibraryPanelView } from "@ui/interface_preferences/libraryPreferences";
import { ColorSamplerProvider } from '@ui/canvas/color_sampler/ColorSamplerProvider';
import { useEncounterOperation } from "@ui/history/useEncounterOperation";
import { runEncounterOperation } from "@core/history/encounterOperations";
import { EncounterHistoryKeyboard } from "@ui/history/EncounterHistoryKeyboard";
import { MembershipChoiceDialog } from './membership/MembershipChoiceDialog';
import { WorkspaceKeyboardShortcuts } from "./keybinds/WorkspaceKeyboardShortcuts";
import { ignoreShortcut } from "./keybinds/keyboardGuards";
import { CombatPreferenceProvider } from "@ui/combat_preferences/CombatPreferenceProvider";
import { StatusPanel } from "@ui/panels/StatusPanel";
import { StatusPopoutProvider } from "@ui/panels/status_panel/StatusPopoutProvider";
import { StatusLauncherButton } from "@ui/panels/status_panel/StatusLauncherButton";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";

import { selectRulerPropertiesArtifact } from "@interaction/rulerState";
import { setActiveTool } from "@interaction/interactionState";
import { MVP_TOOLS, TOOL_DEFINITIONS_BY_ID } from "@interaction/tools/toolRegistry";
import { CanvasShell } from "./canvas/CanvasShell";
import { CanvasViewportProvider } from "./canvas/CanvasViewportContext";
import type { DockPanelDefinition, DockSide, DropTarget } from "./panels/PanelsShell";
import { LibraryPanel, LibraryPanelHeaderActions } from "./panels/LibraryPanel";
import { LogPanel, LogPanelHeaderActions } from "./panels/LogPanel";
import { InitiativePanel } from "./panels/InitiativePanel";
import { InitiativePopoutProvider } from "./panels/initiative/InitiativePopoutProvider";
import { InitiativeLauncherButton } from "./panels/initiative/InitiativeLauncherButton";
import type {
  LibraryPanelFocusRequest,
  LibraryViewMode
} from "./panels/LibraryPanel";
import { movePanel } from "./panels/panelLayout";
import type { PanelLayout } from "./panels/panelLayout";
import { PropertiesPanel } from "./panels/PropertiesPanel";
import { WorkspaceSidebar } from "./panels/WorkspaceSidebar";
import { usePanelNativeDragPreview } from "./panels/usePanelNativeDragPreview";
import { getLibraryPanelSectionId } from "./panels/libraryPanelSection";
import { EngageActionButton } from "./toolbar/EngageActionButton";
import { DisengageActionButton } from "./toolbar/DisengageActionButton";
import { ZonelessVisibilityButton } from "./panels/zoneless_actors/ZonelessVisibilityButton";
import { ActorPropertiesHeaderActions } from "./panels/ActorPropertiesPanel";
import { ZonePropertiesHeaderActions } from "./panels/ZonePropertiesPanel";
import { Toolbar } from "./toolbar/Toolbar";
import type { RootState } from "@store/store";
import { commitEncounterChange } from "@store/encounterSlice";
import { createEncounterActionRecord } from "@core/history/createEncounterActionRecord";
import { resolveLibraryAsset } from "@library/librarySlice";
import type { LibraryNode } from "@library/types";
import type { ActorImageInput } from "@entities/actor/actorMutations";
import { SelectionRenameModal } from "./selection/SelectionRenameModal";
import { ZoneResizeApprovalProvider } from "./zoneResizeApproval";
import { MotionPreferenceProvider } from "./motion_preferences/MotionPreferenceProvider";
import { readImageAssetDimensions } from "./toolbar/background/readImageFile";
import { commitBackgroundImage } from "./toolbar/background/backgroundCanvasActions";
import { useCanvasViewport } from "./canvas/CanvasViewportContext";
import { useCompactLayout } from "@hooks/useCompactLayout";
import type { CompactPanelDefinition } from "./panels/compactPanelMetadata";
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
import { InterfacePreferenceProvider } from "./interface_preferences/InterfacePreferenceProvider";
import { useInterfacePreferences } from "./interface_preferences/InterfacePreferenceProvider";
import {
  getVisibleCompactPanels,
  getVisiblePanelLayout,
  resolveVisibleDropTarget
} from "./panels/panelVisibilityLayout";
import { AudioPlaybackProvider } from "./audio/AudioPlaybackProvider";
import { AudioTriggerBridge } from "./audio/AudioTriggerBridge";
import { AudioPanel, AudioPanelHeaderActions } from "./panels/AudioPanel";
import { SoundboardProvider } from "./audio/SoundboardProvider";
import { useAudioCueAssignment } from "./audio/useAudioCueAssignment";
import type { AudioCuePlacement } from "@entities/audio/types";
import { OPEN_AUDIO_LIBRARY_EVENT, RELINK_AUDIO_LIBRARY_EVENT } from "./audio/audioLibraryEvents";

type SidebarCollapsedState = Record<DockSide, boolean>;

const toolKeybindActions = Object.fromEntries(
  [...MVP_TOOLS, TOOL_DEFINITIONS_BY_ID.ruler].map((tool) => [tool.id, `tool.${tool.id}`])
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
  const { panelVisibility, libraryPanelViewDefault, panelTabMode, zonelessPanelPlacement } = useInterfacePreferences();
  const zonelessInSidebar = zonelessPanelPlacement === "sidebar";
  const dockVisibility = { ...panelVisibility, zoneless: zonelessInSidebar && panelVisibility.zoneless };
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const hasRulerRenameTarget = useSelector((state: RootState) => Boolean(selectRulerPropertiesArtifact(state)));
  const compactLayout = useCompactLayout();
  const visualViewport = useVisualViewportRect();
  const panelLayout = encounter.panelLayout;
  const [libraryAutoCollapsedBySelect, setLibraryAutoCollapsedBySelect] =
    useState(false);
  const [zonelessVisible, setZonelessVisible] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState<SidebarCollapsedState>({
      left: false,
      right: false
    });
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  useEncounterOperation(draggedPanelId !== null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [libraryFocusRequest, setLibraryFocusRequest] =
    useState<LibraryPanelFocusRequest | null>(null);
  const [actorCreationImage, setActorCreationImage] =
    useState<ActorImageInput | null>(null);
  const [libraryViewOverride, setLibraryViewMode] = useState<LibraryViewMode | null>(null);
  const libraryViewMode = libraryViewOverride ?? libraryPanelViewDefault;
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [encounterRenameOpen, setEncounterRenameOpen] = useState(false);
  const [showAudioCueVolumes, setShowAudioCueVolumes] = useState(false);
  const audioAssignment = useAudioCueAssignment();
  const persistenceUi = useAppPersistenceUi({
    onAudioDoubleClick: addAudioCueFromLibrary,
    onActorTokenSelect: applyActorTokenFromLibrary,
    onBackgroundDoubleClick: applyBackgroundFromLibrary,
    onTokenDoubleClick: focusTokenInLibrary
  });

  useEffect(() => {
    const openAudioLibrary = (event: Event) => {
      persistenceUi.openAudioLibraryForCue((event as CustomEvent<AudioCuePlacement>).detail);
    };
    window.addEventListener(OPEN_AUDIO_LIBRARY_EVENT, openAudioLibrary);
    const relinkAudio = (event: Event) => persistenceUi.openAudioLibraryForRelink((event as CustomEvent<string>).detail);
    window.addEventListener(RELINK_AUDIO_LIBRARY_EVENT, relinkAudio);
    return () => {
      window.removeEventListener(OPEN_AUDIO_LIBRARY_EVENT, openAudioLibrary);
      window.removeEventListener(RELINK_AUDIO_LIBRARY_EVENT, relinkAudio);
    };
  }, [persistenceUi.openAudioLibraryForCue, persistenceUi.openAudioLibraryForRelink]);
  const effectivePanelLayout = libraryAutoCollapsedBySelect
    ? mapLibraryPanel(panelLayout, (panel) => ({ ...panel, collapsed: true }))
    : panelLayout;
  const visiblePanelLayout = getVisiblePanelLayout(
    effectivePanelLayout,
    dockVisibility
  );
  const compactPanels = getVisibleCompactPanels(panelVisibility);
  usePanelNativeDragPreview(draggedPanelId, visiblePanelLayout, handlePanelDropPreview);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (ignoreShortcut(event)) return;
      if (matchesKeybind(event, bindings["workspace.save"])) {
        event.preventDefault();
        void persistenceUi.requestSave();
        return;
      }

      if (shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (
        matchesKeybind(event, bindings["actor.rename"]) &&
        (hasRulerRenameTarget ||
          (["actor", "zone"].includes(selection.selectedEntityType ?? "") &&
            selection.selectedIds.length > 0))
      ) {
        event.preventDefault();
        setRenameModalOpen(true);
        return;
      }

      const nextTool = [...MVP_TOOLS, TOOL_DEFINITIONS_BY_ID.ruler].find((tool) =>
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
  }, [bindings, dispatch, selection, hasRulerRenameTarget, persistenceUi]);

  function mapLibraryPanel(
    layout: PanelLayout,
    mapper: (panel: PanelLayout[DockSide][number]) => PanelLayout[DockSide][number]
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

    const libraryPanel = [...panelLayout.left, ...panelLayout.right].find(
      (panel) => panel.id === "library"
    );
    setLibraryAutoCollapsedBySelect(libraryPanel?.collapsed === false);
  }, [activeToolId, panelLayout]);

  function expandAutoCollapsedLibraryPanel() {
    if (!libraryAutoCollapsedBySelect) {
      return;
    }

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
    setLibraryAutoCollapsedBySelect(false);
    dispatch(setActiveTool("actor"));
  }

  function addAudioCueFromLibrary(node: LibraryNode, placement?: AudioCuePlacement, relinkCueId?: string) {
    if (relinkCueId) audioAssignment.relink(relinkCueId, node);
    else if (placement) audioAssignment.addToGroup(node, placement);
    else audioAssignment.requestDestination(node);
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
      void runEncounterOperation(() => readImageAssetDimensions(asset, cloud?.resolveImageAsset).then(commitImage));
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

    // Hidden panels must not turn a visibly unchanged drop into a history entry.
    const nextLayout = movePanel(visiblePanelLayout, panelId, target) === visiblePanelLayout
      ? panelLayout
      : movePanel(panelLayout, panelId, resolveVisibleDropTarget(panelLayout, dockVisibility, target));
    if (nextLayout !== panelLayout) {
      dispatch(
        commitEncounterChange({
          action: {
            ...createEncounterActionRecord("interface.movePanel", {
              panelId,
              side: target.side
            }),
            validationResult: undefined
          },
          nextEncounter: { ...encounter, panelLayout: nextLayout }
        })
      );
    }
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

    const nextLayout: PanelLayout = {
      left: panelLayout.left.map((panel) =>
        panel.id === panelId ? { ...panel, collapsed } : panel
      ),
      right: panelLayout.right.map((panel) =>
        panel.id === panelId ? { ...panel, collapsed } : panel
      )
    };
    dispatch(
      commitEncounterChange({
        action: {
          ...createEncounterActionRecord("interface.setPanelCollapsed", {
            collapsed,
            panelId
          }),
          validationResult: undefined
        },
        nextEncounter: { ...encounter, panelLayout: nextLayout }
      })
    );
  }

  function openLibraryForActiveTool() {
    persistenceUi.openLibrary(
      activeToolId === "background" ? "backgrounds" : activeToolId === "actor" ? "tokens" : activeToolId === "audio" ? "audio" : "encounters"
    );
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

    if (panel.id === "status") return <StatusPanel />;

    if (panel.id === "audio") return <AudioPanel showVolume={showAudioCueVolumes} />;

    if (panel.id === "zoneless") {
      return <CompactZonelessActorPanel />;
    }

    return undefined;
  }

  function renderPanelHeaderActions(
    panel: DockPanelDefinition | CompactPanelDefinition
  ) {
    if (panel.id === "initiative") return <InitiativeLauncherButton />;
    if (panel.id === "status") return <div className="flex items-center gap-1"><CanvasStatusVisibilityButton /><StatusLauncherButton /></div>;
    if (panel.id === "library") {
      return (
        <LibraryPanelHeaderActions
          libraryOpen={persistenceUi.libraryOpen}
          onOpenLibrary={openLibraryForActiveTool}
          onToggle={() =>
            setLibraryViewMode(nextLibraryPanelView(libraryViewMode))
          }
          viewMode={libraryViewMode}
        />
      );
    }

    if (panel.id === "properties") {
      return <><ActorPropertiesHeaderActions /><ZonePropertiesHeaderActions /></>;
    }

    if (panel.id === "log") {
      return <LogPanelHeaderActions />;
    }

    if (panel.id === "audio") {
      return <AudioPanelHeaderActions onToggleVolume={() => setShowAudioCueVolumes((shown) => !shown)} showVolume={showAudioCueVolumes} />;
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
      <FocusLightProvider><PlayerViewProvider>
      <ZoneResizeApprovalProvider>
      <EncounterHistoryKeyboard />
      <WorkspaceKeyboardShortcuts onOpenLibrary={openLibraryForActiveTool} onTogglePanels={() => {
        setSidebarCollapsed(current => {
          const anyOpen = (visiblePanelLayout.left.length > 0 && !current.left)
            || (visiblePanelLayout.right.length > 0 && !current.right);
          return { left: anyOpen, right: anyOpen };
        });
      }} />
      <InitiativePopoutProvider>
      <StatusPopoutProvider>
      <PlayerWorkspace>
      <Toolbar
        actorCreationImage={actorCreationImage}
        encounterToolSelectionRequest={
          persistenceUi.encounterToolSelectionRequest
        }
        encounterName={encounter.name}
        hasSavedEncounter={persistenceUi.hasSavedEncounter}
        libraryOpen={persistenceUi.libraryOpen}
        onActorToolSelected={expandAutoCollapsedLibraryPanel}
        onActorCreationImageHandled={() => setActorCreationImage(null)}
        onOpenLibrary={openLibraryForActiveTool}
        onOpenSettings={persistenceUi.openSettings}
        onRenameEncounter={() => setEncounterRenameOpen(true)}
        onSaveEncounter={() => void persistenceUi.requestSave()}
        persistenceReadOnly={persistenceUi.readOnly}
        saveStatus={persistenceUi.saveStatus}
      />
      <main
        className="relative isolate grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[max-content_minmax(0,1fr)_max-content] lg:gap-4 lg:p-4"
      >
        {!compactLayout ? (
        <WorkspaceSidebar
          encounterId={encounter.id}
          tabMode={panelTabMode}
          libraryAvailable={getLibraryPanelSectionId(activeToolId) !== null}
          collapsed={
            visiblePanelLayout.left.length === 0 || sidebarCollapsed.left
          }
          footerActions={<SettingsButton onClick={persistenceUi.openSettings} />}
          footerEnd={!zonelessInSidebar && panelVisibility.zoneless ? <ZonelessVisibilityButton
            visible={zonelessVisible}
            onToggle={() => setZonelessVisible(value => !value)}
          /> : undefined}
          onToggle={() =>
            setSidebarCollapsed((current) => ({
              ...current,
              left: !current.left
            }))
          }
          side="left"
          disabledExpansionPanelIds={getLibraryPanelSectionId(activeToolId) ? [] : ["library"]}
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
          panels={visiblePanelLayout.left}
          renderPanelHeaderActions={renderPanelHeaderActions}
          renderPanelContent={renderPanelContent}
        />
        ) : null}
        <CanvasShell
          zonelessVisible={zonelessVisible && !zonelessInSidebar && panelVisibility.zoneless}
          compactPanels={compactPanels}
          renderCompactPanelContent={renderPanelContent}
          renderCompactPanelHeaderActions={renderPanelHeaderActions}
        />
        {!compactLayout ? (
        <WorkspaceSidebar
          encounterId={encounter.id}
          tabMode={panelTabMode}
          libraryAvailable={getLibraryPanelSectionId(activeToolId) !== null}
          collapsed={
            visiblePanelLayout.right.length === 0 || sidebarCollapsed.right
          }
          headerActions={
            <div className={`flex gap-2 ${
              visiblePanelLayout.right.length === 0 || sidebarCollapsed.right
                ? "flex-col items-start"
                : "items-center justify-start"
            }`}>
              <EngageActionButton />
              <DisengageActionButton />
            </div>
          }
          onToggle={() =>
            setSidebarCollapsed((current) => ({
              ...current,
              right: !current.right
            }))
          }
          side="right"
          disabledExpansionPanelIds={getLibraryPanelSectionId(activeToolId) ? [] : ["library"]}
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
          panels={visiblePanelLayout.right}
          renderPanelHeaderActions={renderPanelHeaderActions}
          renderPanelContent={renderPanelContent}
        />
        ) : null}
      </main>
      </PlayerWorkspace>
      {persistenceUi.dialogs}
      {audioAssignment.dialog}
      {renameModalOpen ? (
        <SelectionRenameModal onClose={() => setRenameModalOpen(false)} />
      ) : null}
      {encounterRenameOpen ? (
        <EncounterRenameDialog onClose={() => setEncounterRenameOpen(false)} />
      ) : null}
      </StatusPopoutProvider>
      </InitiativePopoutProvider>
      </ZoneResizeApprovalProvider>
      </PlayerViewProvider></FocusLightProvider>
        </div>
      </TouchTooltipProvider>
    </MotionPreferenceProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <InterfacePreferenceProvider>
        <CombatPreferenceProvider>
          <AudioPlaybackProvider>
            <SoundboardProvider>
              <AudioTriggerBridge />
              <KeybindProvider>
                <CanvasViewportProvider>
                  <ColorSamplerProvider>
                  <LiveSceneMotionProvider><PlayerSceneProvider><AppContent /></PlayerSceneProvider></LiveSceneMotionProvider>
                  <MembershipChoiceDialog />
                  </ColorSamplerProvider>
                </CanvasViewportProvider>
              </KeybindProvider>
            </SoundboardProvider>
          </AudioPlaybackProvider>
        </CombatPreferenceProvider>
      </InterfacePreferenceProvider>
    </ThemeProvider>
  );
}
