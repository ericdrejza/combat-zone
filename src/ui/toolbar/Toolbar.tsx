import { useSelector } from "react-redux";

import type { RootState } from "@store/store";
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

type ToolbarProps = {
  onActorToolSelected: () => void;
  onOpenLibrary: () => void;
};

export function Toolbar({ onActorToolSelected, onOpenLibrary }: ToolbarProps) {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const edgeTool = useSelector((state: RootState) => state.interaction.edgeTool);
  function renderTool(item: (typeof TOOLBAR_ITEMS)[number]) {
    if (item.type === "separator") {
      return (
        <span
          key={item.id}
          aria-orientation="vertical"
          className="mx-1 h-8 w-px shrink-0 self-center bg-canvas-line"
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
          tool={tool}
        />
      );
    }

    if (tool.id === "zone") {
      return (
        <ZoneToolButton
          key={tool.id}
          activeToolId={activeToolId}
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
          onSelected={onActorToolSelected}
          tool={tool}
        />
      );
    }

    if (tool.id === "edge") {
      return <EdgeToolButton key={tool.id} activeToolId={activeToolId} edgeTool={edgeTool} encounter={encounter} tool={tool} />;
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
      className="h-16 min-h-16 overflow-hidden border-b border-canvas-line bg-canvas-panel px-4 py-3 shadow-sm"
    >
      <div className="flex h-full min-w-0 flex-nowrap items-center gap-2">
        <h1 className="mr-4 shrink-0 font-display text-2xl font-semibold tracking-tight">
          Combat Zone
        </h1>
        <nav
          aria-label="Tools"
          className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto"
        >
          <LibraryToolbarButton onOpenLibrary={onOpenLibrary} />
          <span
            aria-orientation="vertical"
            className="mx-1 h-8 w-px shrink-0 self-center bg-canvas-line"
            role="separator"
          />
          {TOOLBAR_ITEMS.map(renderTool)}
          <EngageActionButton />
          <DisengageActionButton />
        </nav>
        <MotionPreferenceWarning />
      </div>
    </header>
  );
}
