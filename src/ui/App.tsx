import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { setActiveTool } from "../interaction/interactionState";
import { MVP_TOOLS } from "../interaction/tools/toolRegistry";
import type { ToolId } from "../interaction/tools/toolRegistry";
import { CanvasShell } from "./canvas/CanvasShell";
import type { DockPanelDefinition, DockSide, DropTarget } from "./panels/PanelsShell";
import { movePanel } from "./panels/panelLayout";
import type { PanelLayout } from "./panels/panelLayout";
import { PanelsShell } from "./panels/PanelsShell";
import { SidebarDock } from "./panels/SidebarDock";
import {
  ZonePropertiesHeaderActions,
  ZonePropertiesPanel
} from "./panels/ZonePropertiesPanel";
import { Toolbar } from "./toolbar/Toolbar";

type SidebarCollapsedState = Record<DockSide, boolean>;

const initialPanelLayout: PanelLayout = {
  left: [
    { id: "library", title: "Library", collapsed: false },
    { id: "properties", title: "Properties", collapsed: false },
    { id: "validation", title: "Validation", collapsed: false }
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

export function App() {
  const dispatch = useDispatch();
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(initialPanelLayout);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState<SidebarCollapsedState>({
      left: false,
      right: false
    });
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const workspaceColumns = `${
    sidebarCollapsed.left ? "3.25rem" : "18rem"
  } minmax(0,1fr) ${sidebarCollapsed.right ? "3.25rem" : "18rem"}`;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const shortcut = event.key.toLowerCase();
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
  }, [dispatch]);

  function handlePanelDrop(target: DropTarget) {
    if (!draggedPanelId) {
      return;
    }

    setPanelLayout((layout) => movePanel(layout, draggedPanelId, target));
    setDraggedPanelId(null);
    setDropTarget(null);
  }

  function handlePanelCollapsedChange(panelId: string, collapsed: boolean) {
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
    if (panel.id === "properties") {
      return <ZonePropertiesPanel />;
    }

    return undefined;
  }

  function renderPanelHeaderActions(panel: DockPanelDefinition) {
    if (panel.id === "properties") {
      return <ZonePropertiesHeaderActions />;
    }

    return undefined;
  }

  return (
    <div className="flex h-screen max-h-screen w-screen max-w-screen flex-col overflow-hidden bg-canvas text-canvas-ink">
      <Toolbar />
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
    </div>
  );
}
