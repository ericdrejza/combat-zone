import {
  DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  type DockablePanelVisibility
} from "@ui/panels/dockablePanelMetadata";

/** Keeps older preferences compatible when new panels are introduced. */
export function readPanelVisibility(
  stored: Partial<DockablePanelVisibility> | undefined
): DockablePanelVisibility {
  return Object.fromEntries(
    Object.entries(DEFAULT_DOCKABLE_PANEL_VISIBILITY).map(([id, defaultVisible]) => {
      const visible = stored?.[id as keyof DockablePanelVisibility];
      return [id, typeof visible === "boolean" ? visible : defaultVisible];
    })
  ) as DockablePanelVisibility;
}
