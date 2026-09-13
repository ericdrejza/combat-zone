import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { getEncounterLoadTool } from "@core/encounter";
import { useCompactLayout } from "@hooks/useCompactLayout";
import { useMobileControls } from "@hooks/useMobileControls";
import { setActiveTool } from "@interaction/interactionState";
import type { RootState } from "@store/store";
import type { ActorImageInput } from "@entities/actor/actorMutations";
import { EncounterTitle } from "@ui/encounter/EncounterTitle";
import { SettingsButton } from "@ui/settings/SettingsButton";
import { ActorToolButton } from "./actor/ActorToolButton";
import { BackgroundToolButton } from "./background/BackgroundToolButton";
import { LibraryToolbarButton } from "./LibraryToolbarButton";
import { ToolButton } from "./ToolButton";
import { TOOLBAR_ITEMS } from "./toolbarItems";
import { ZoneToolButton } from "./zone/ZoneToolButton";
import { MotionPreferenceWarning } from "./MotionPreferenceWarning";
import { EngageActionButton } from './EngageActionButton';
import { DisengageActionButton } from './DisengageActionButton';
import { EdgeToolButton } from './edge/EdgeToolButton';
import { CanvasZoomControls } from "./CanvasZoomControls";
import {
  EncounterTitleControls,
  type SaveStatus
} from "./EncounterTitleControls";
import { CloudStatusIndicator } from "@ui/cloud_sync";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

type ToolbarProps = {
  actorCreationImage?: ActorImageInput | null;
  encounterName: string;
  encounterToolSelectionRequest?: number;
  hasSavedEncounter?: boolean;
  libraryOpen?: boolean;
  onActorCreationImageHandled?: () => void;
  onActorToolSelected: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
  onRenameEncounter: () => void;
  onSaveEncounter?: () => void;
  persistenceReadOnly?: boolean;
  saveStatus?: SaveStatus;
};

export function Toolbar({
  actorCreationImage = null,
  encounterName,
  encounterToolSelectionRequest = 0,
  hasSavedEncounter = false,
  libraryOpen = false,
  onActorCreationImageHandled,
  onActorToolSelected,
  onOpenLibrary,
  onOpenSettings,
  onRenameEncounter,
  onSaveEncounter = () => undefined,
  persistenceReadOnly = false,
  saveStatus = "idle"
}: ToolbarProps) {
  const compactLayout = useCompactLayout();
  const showMobileControls = useMobileControls(compactLayout);
  const { encounterCreationTool } = useInterfacePreferences();
  const dispatch = useDispatch();
  const [compactSubtoolHost, setCompactSubtoolHost] =
    useState<HTMLDivElement | null>(null);
  const [compactEncounterOpen, setCompactEncounterOpen] = useState(false);
  const [compactZoomOpen, setCompactZoomOpen] = useState(false);
  const lastToolSelectionRequest = useRef<number | null>(null);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const edgeTool = useSelector((state: RootState) => state.interaction.edgeTool);
  const visibleActiveToolId = compactEncounterOpen ? null : activeToolId;

  useEffect(() => {
    if (lastToolSelectionRequest.current === encounterToolSelectionRequest) {
      return;
    }

    lastToolSelectionRequest.current = encounterToolSelectionRequest;
    if (
      encounterToolSelectionRequest === 0 &&
      !hasSavedEncounter &&
      activeToolId !== "zone"
    ) {
      return;
    }

    const nextTool = hasSavedEncounter
      ? getEncounterLoadTool(encounter)
      : encounterCreationTool;
    dispatch(setActiveTool(nextTool));
  }, [
    dispatch,
    encounter,
    encounterCreationTool,
    encounterToolSelectionRequest,
    hasSavedEncounter,
    activeToolId
  ]);

  useEffect(() => {
    setCompactZoomOpen(false);
    setCompactEncounterOpen(false);
  }, [activeToolId]);

  function renderTool(item: (typeof TOOLBAR_ITEMS)[number]) {
    if (item.type === "separator") {
      return (
      <span
          key={item.id}
          aria-orientation="vertical"
          className="mx-1 hidden h-8 w-px shrink-0 self-center bg-canvas-line lg:block"
          role="separator"
        />
      );
    }

    const { tool } = item;

    if (tool.id === "background") {
      return (
        <BackgroundToolButton
          key={tool.id}
          activeToolId={visibleActiveToolId}
          encounter={encounter}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen || compactEncounterOpen ? null : compactSubtoolHost}
          tool={tool}
          onOpenLibrary={onOpenLibrary}
        />
      );
    }

    if (tool.id === "zone") {
      return (
        <ZoneToolButton
          key={tool.id}
          activeToolId={visibleActiveToolId}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen || compactEncounterOpen ? null : compactSubtoolHost}
          tool={tool}
          zoneShapeMode={zoneShapeMode}
        />
      );
    }

    if (tool.id === "actor") {
      return (
        <ActorToolButton
          key={tool.id}
          activeToolId={visibleActiveToolId}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen || compactEncounterOpen ? null : compactSubtoolHost}
          onOpenLibrary={onOpenLibrary}
          onSelected={onActorToolSelected}
          actorCreationImage={actorCreationImage}
          onActorCreationImageHandled={onActorCreationImageHandled}
          tool={tool}
        />
      );
    }

    if (tool.id === "edge") {
      return <EdgeToolButton key={tool.id} activeToolId={visibleActiveToolId} compactLayout={compactLayout} compactSubtoolHost={compactZoomOpen || compactEncounterOpen ? null : compactSubtoolHost} edgeTool={edgeTool} encounter={encounter} tool={tool} />;
    }

    return (
      <ToolButton
        key={tool.id}
        activeToolId={visibleActiveToolId}
        tool={tool}
      />
    );
  }

  return (
    <header
      aria-label="Combat Zone toolbar"
      className="min-h-16 overflow-hidden border-b border-canvas-line bg-canvas-panel px-2 py-2 shadow-sm lg:h-16 lg:px-4 lg:py-3"
    >
      <div className="flex min-w-0 flex-col gap-2 lg:h-full lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
        {!compactLayout ? (
          <h1 className="relative z-50 min-w-0 max-w-[min(28rem,35vw)] shrink-0 font-display font-semibold tracking-tight">
            <EncounterTitle
              name={encounterName}
              onRename={onRenameEncounter}
              readOnly={persistenceReadOnly}
            />
          </h1>
        ) : null}
        {!compactLayout ? (
          <EncounterTitleControls
            hasSavedEncounter={hasSavedEncounter}
            onSave={onSaveEncounter}
            readOnly={persistenceReadOnly}
            saveStatus={saveStatus}
            showTitle={false}
          />
        ) : null}
        <CloudStatusIndicator />
        <nav
          aria-label="Tools"
          className="scrollbar-hidden flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto"
          onClickCapture={(event) => {
            const target = event.target as Element;
            if (target.closest("[data-toolbar-subtools]")) {
              return;
            }
            const button = target.closest("button");
            if (
              button?.getAttribute("aria-label") !== "Zoom controls" &&
              !button?.hasAttribute("data-compact-encounter-toggle")
            ) {
              setCompactZoomOpen(false);
              setCompactEncounterOpen(false);
            }
          }}
        >
          {compactLayout ? (
            <EncounterTitle
              compact
              compactOpen={compactEncounterOpen}
              name={encounterName}
              onCompactToggle={() => {
                setCompactZoomOpen(false);
                setCompactEncounterOpen((open) => !open);
              }}
              onRename={onRenameEncounter}
              readOnly={persistenceReadOnly}
            />
          ) : null}
          <LibraryToolbarButton active={libraryOpen} onOpenLibrary={onOpenLibrary} />
          <span
            aria-orientation="vertical"
            className="mx-1 hidden h-8 w-px shrink-0 self-center bg-canvas-line lg:block"
            role="separator"
          />
          {TOOLBAR_ITEMS.map(renderTool)}
          {!showMobileControls ? <EngageActionButton /> : null}
          {!showMobileControls ? <DisengageActionButton /> : null}
          {compactLayout ? (
          <CanvasZoomControls
            compactOpen={compactZoomOpen}
            compactSubtoolHost={compactEncounterOpen ? null : compactSubtoolHost}
            onCompactToggle={() => {
              setCompactEncounterOpen(false);
              setCompactZoomOpen((open) => !open);
            }}
          />
          ) : null}
        </nav>
        <MotionPreferenceWarning />
        {compactLayout ? <SettingsButton onClick={onOpenSettings} /> : null}
        </div>
        {!compactLayout ? (
          <div className="ml-auto shrink-0">
            <CanvasZoomControls />
          </div>
        ) : null}
        <div
          ref={setCompactSubtoolHost}
          aria-label="Active tool options"
          className="scrollbar-hidden flex min-h-0 w-full items-center gap-2 overflow-x-auto empty:hidden lg:hidden"
          data-toolbar-subtools="true"
        >
          {compactLayout && compactEncounterOpen ? (
            <div
              aria-label="Encounter controls"
              className="flex min-w-full items-center gap-2"
            >
              <button
                aria-label={`Rename encounter ${encounterName}`}
                className="min-w-0 truncate px-1 text-left font-display text-base font-semibold tracking-tight hover:underline disabled:cursor-not-allowed"
                disabled={persistenceReadOnly}
                onClick={onRenameEncounter}
                type="button"
              >
                {encounterName}
              </button>
              <div className="ml-auto shrink-0">
                <EncounterTitleControls
                  hasSavedEncounter={hasSavedEncounter}
                  onSave={onSaveEncounter}
                  readOnly={persistenceReadOnly}
                  saveStatus={saveStatus}
                  showTitle={false}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
