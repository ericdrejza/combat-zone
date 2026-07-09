import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

import type { RootState } from "../../store/store";
import { ActorToolButton } from "./actor/ActorToolButton";
import { BackgroundToolButton } from "./background/BackgroundToolButton";
import { CLOSE_ZONE_SHAPE_MENU_EVENT } from "./events";
import { LibraryToolbarButton } from "./LibraryToolbarButton";
import { ToolButton } from "./ToolButton";
import { TOOLBAR_ITEMS } from "./toolbarItems";
import { ZoneToolButton } from "./zone/ZoneToolButton";

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
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [zoneMenuOpen, setZoneMenuOpen] = useState(false);

  useEffect(() => {
    function closeZoneMenu() {
      setZoneMenuOpen(false);
    }

    window.addEventListener(CLOSE_ZONE_SHAPE_MENU_EVENT, closeZoneMenu);

    return () => {
      window.removeEventListener(CLOSE_ZONE_SHAPE_MENU_EVENT, closeZoneMenu);
    };
  }, []);

  function closeMenus() {
    setBackgroundMenuOpen(false);
    setZoneMenuOpen(false);
  }

  function renderTool(item: (typeof TOOLBAR_ITEMS)[number]) {
    if (item.type === "separator") {
      return (
        <span
          key={item.id}
          aria-orientation="vertical"
          className="mx-1 h-8 w-px self-center bg-canvas-line"
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
          menuOpen={backgroundMenuOpen}
          onCloseZoneMenu={() => setZoneMenuOpen(false)}
          setMenuOpen={setBackgroundMenuOpen}
          tool={tool}
        />
      );
    }

    if (tool.id === "zone") {
      return (
        <ZoneToolButton
          key={tool.id}
          activeToolId={activeToolId}
          menuOpen={zoneMenuOpen}
          onCloseBackgroundMenu={() => setBackgroundMenuOpen(false)}
          setMenuOpen={setZoneMenuOpen}
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
          onCloseMenus={closeMenus}
          onSelected={onActorToolSelected}
          tool={tool}
        />
      );
    }

    return (
      <ToolButton
        key={tool.id}
        activeToolId={activeToolId}
        onCloseMenus={closeMenus}
        tool={tool}
      />
    );
  }

  return (
    <header
      aria-label="Combat Zone toolbar"
      className="border-b border-canvas-line bg-canvas-panel px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 font-display text-2xl font-semibold tracking-tight">
          Combat Zone
        </h1>
        <nav aria-label="Tools" className="flex flex-wrap gap-2">
          <LibraryToolbarButton onOpenLibrary={onOpenLibrary} />
          <span
            aria-orientation="vertical"
            className="mx-1 h-8 w-px self-center bg-canvas-line"
            role="separator"
          />
          {TOOLBAR_ITEMS.map(renderTool)}
        </nav>
      </div>
    </header>
  );
}
