import type { EncounterPanelLayout } from "@core/encounter/panelLayout";

/** Historical schema fixtures must omit panels introduced after their declared version. */
export function withLegacyPanelLayout<T extends { panelLayout: EncounterPanelLayout }>(state: T): T {
  return {
    ...state,
    panelLayout: {
      left: state.panelLayout.left.filter(panel => panel.id !== "zoneless"),
      right: state.panelLayout.right.filter(panel => panel.id !== "zoneless")
    }
  };
}
