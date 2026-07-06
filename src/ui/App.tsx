import { useState } from "react";

import { CanvasShell } from "./canvas/CanvasShell";
import type { DockPanelDefinition, DockSide, DropTarget } from "./panels/PanelsShell";
import { PanelsShell } from "./panels/PanelsShell";
import { Toolbar } from "./toolbar/Toolbar";

type PanelLayout = Record<DockSide, DockPanelDefinition[]>;

const initialPanelLayout: PanelLayout = {
  left: [
    { id: "library", title: "Library", collapsed: false },
    { id: "initiative", title: "Initiative", collapsed: false }
  ],
  right: [
    { id: "properties", title: "Properties", collapsed: false },
    {
      id: "status",
      title: "Status",
      description: "Entity detail scaffold.",
      collapsed: false
    },
    { id: "validation", title: "Validation", collapsed: false }
  ]
};

export function movePanel(
  layout: PanelLayout,
  panelId: string,
  target: DropTarget
): PanelLayout {
  const sourceSide = layout.left.some((panel) => panel.id === panelId)
    ? "left"
    : "right";
  const sourceIndex = layout[sourceSide].findIndex(
    (panel) => panel.id === panelId
  );
  const movingPanel = layout[sourceSide][sourceIndex];

  if (!movingPanel) {
    return layout;
  }

  const nextLayout: PanelLayout = {
    left: layout.left.filter((panel) => panel.id !== panelId),
    right: layout.right.filter((panel) => panel.id !== panelId)
  };
  const targetPanels = nextLayout[target.side];
  const adjustedTargetIndex =
    target.side === sourceSide && target.index > sourceIndex
      ? target.index - 1
      : target.index;
  const targetIndex = Math.min(adjustedTargetIndex, targetPanels.length);

  nextLayout[target.side] = [
    ...targetPanels.slice(0, targetIndex),
    movingPanel,
    ...targetPanels.slice(targetIndex)
  ];

  return nextLayout;
}

export function App() {
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(initialPanelLayout);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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

  return (
    <div className="min-h-screen bg-canvas text-canvas-ink">
      <Toolbar />
      <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-4 p-4 lg:grid-cols-[18rem_minmax(0,1fr)_18rem]">
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
          side="left"
        />
        <CanvasShell />
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
          side="right"
        />
      </main>
    </div>
  );
}
