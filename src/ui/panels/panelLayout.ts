import type { DockPanelDefinition, DockSide, DropTarget } from "./PanelsShell";

export type PanelLayout = Record<DockSide, DockPanelDefinition[]>;

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
