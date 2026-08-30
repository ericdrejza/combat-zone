import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import { useCompactLayout } from "@hooks/useCompactLayout";
import type { RootState } from "@store/store";
import { EncounterTitle } from "@ui/encounter/EncounterTitle";
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
import { ToolbarSubtoolBar } from "./ToolbarOption";
import { TouchSelectionToggle } from "./TouchSelectionToggle";

type ToolbarProps = {
  encounterName: string;
  onActorToolSelected: () => void;
  onOpenLibrary: () => void;
  onRenameEncounter: () => void;
};

export function Toolbar({
  encounterName,
  onActorToolSelected,
  onOpenLibrary,
  onRenameEncounter
}: ToolbarProps) {
  const compactLayout = useCompactLayout();
  const [compactSubtoolHost, setCompactSubtoolHost] =
    useState<HTMLDivElement | null>(null);
  const [compactZoomOpen, setCompactZoomOpen] = useState(false);
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const edgeTool = useSelector((state: RootState) => state.interaction.edgeTool);

  useEffect(() => {
    setCompactZoomOpen(false);
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
          activeToolId={activeToolId}
          encounter={encounter}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen ? null : compactSubtoolHost}
          tool={tool}
        />
      );
    }

    if (tool.id === "zone") {
      return (
        <ZoneToolButton
          key={tool.id}
          activeToolId={activeToolId}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen ? null : compactSubtoolHost}
          tool={tool}
          zoneShapeMode={zoneShapeMode}
        />
      );
    }

    if (tool.id === "actor") {
      return (
        <ActorToolButton
          key={tool.id}
          activeToolId={activeToolId}
          compactLayout={compactLayout}
          compactSubtoolHost={compactZoomOpen ? null : compactSubtoolHost}
          onSelected={onActorToolSelected}
          tool={tool}
        />
      );
    }

    if (tool.id === "edge") {
      return <EdgeToolButton key={tool.id} activeToolId={activeToolId} compactLayout={compactLayout} compactSubtoolHost={compactZoomOpen ? null : compactSubtoolHost} edgeTool={edgeTool} encounter={encounter} tool={tool} />;
    }

    return (
      <ToolButton
        key={tool.id}
        activeToolId={activeToolId}
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
        {!compactLayout ? (
        <h1 className="mr-4 min-w-0 shrink font-display text-2xl font-semibold tracking-tight">
          <EncounterTitle name={encounterName} onRename={onRenameEncounter} />
        </h1>
        ) : null}
        <div className="flex min-w-0 items-center gap-2">
        <nav
          aria-label="Tools"
          className="scrollbar-hidden flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto"
          onClickCapture={(event) => {
            const target = event.target as Element;
            if (target.closest("[data-toolbar-subtools]")) {
              return;
            }
            const button = target.closest("button");
            if (button?.getAttribute("aria-label") !== "Zoom controls") {
              setCompactZoomOpen(false);
            }
          }}
        >
          {compactLayout ? (
            <EncounterTitle
              compact
              iconOnly
              name={encounterName}
              onRename={onRenameEncounter}
            />
          ) : null}
          <LibraryToolbarButton onOpenLibrary={onOpenLibrary} />
          <span
            aria-orientation="vertical"
            className="mx-1 hidden h-8 w-px shrink-0 self-center bg-canvas-line lg:block"
            role="separator"
          />
          {TOOLBAR_ITEMS.map(renderTool)}
          <EngageActionButton />
          <DisengageActionButton />
          {compactLayout ? (
          <CanvasZoomControls
            compactOpen={compactZoomOpen}
            compactSubtoolHost={compactSubtoolHost}
            onCompactToggle={() => setCompactZoomOpen((open) => !open)}
          />
          ) : null}
        </nav>
        <MotionPreferenceWarning />
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
          {!compactZoomOpen &&
          (activeToolId === "select" || activeToolId === "annotation") ? (
            <ToolbarSubtoolBar aria-label="Selection options">
              <TouchSelectionToggle toolId={activeToolId} />
            </ToolbarSubtoolBar>
          ) : null}
        </div>
      </div>
    </header>
  );
}
