import type { DockablePanelVisibility } from "./dockablePanelMetadata";
import { isDockablePanelId } from "./dockablePanelMetadata";
import {
  COMPACT_PANEL_DEFINITIONS,
  type CompactPanelDefinition
} from "./compactPanelMetadata";
import type { DropTarget } from "./PanelsShell";
import type { DockSide, PanelLayout } from "./panelLayout";

export function getVisiblePanelLayout(
  layout: PanelLayout,
  visibility: DockablePanelVisibility
): PanelLayout {
  const visible = (side: DockSide) =>
    layout[side].filter(
      (panel) => isDockablePanelId(panel.id) && visibility[panel.id]
    );
  return { left: visible("left"), right: visible("right") };
}

export function getVisibleCompactPanels(
  visibility: DockablePanelVisibility
): readonly CompactPanelDefinition[] {
  return COMPACT_PANEL_DEFINITIONS.filter(
    (panel) => panel.id === "zoneless" || visibility[panel.id]
  );
}

export function getWorkspaceColumns(
  visibleLayout: PanelLayout,
  sidebarCollapsed: Record<DockSide, boolean>
): string {
  const leftWidth = visibleLayout.left.length === 0 || sidebarCollapsed.left
    ? "3.25rem"
    : "18rem";
  const rightWidth =
    visibleLayout.right.length === 0 || sidebarCollapsed.right
      ? "3.25rem"
      : "18rem";
  return `${leftWidth} minmax(0,1fr) ${rightWidth}`;
}

/** Converts a visible-dock insertion index without relocating hidden panels. */
export function resolveVisibleDropTarget(
  layout: PanelLayout,
  visibility: DockablePanelVisibility,
  target: DropTarget
): DropTarget {
  const visibleTargetPanels = getVisiblePanelLayout(layout, visibility)[target.side];
  const nextVisiblePanel = visibleTargetPanels[target.index];
  return {
    ...target,
    index: nextVisiblePanel
      ? layout[target.side].findIndex((panel) => panel.id === nextVisiblePanel.id)
      : layout[target.side].length
  };
}
