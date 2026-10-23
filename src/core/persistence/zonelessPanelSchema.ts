import { ENCOUNTER_SCHEMA_VERSION, type EncounterState } from "@core/encounter/types";

/** Store Zoneless placement alongside other panels; canvas/sidebar presentation is a preference. */
export function migrateZonelessPanel(state: Omit<EncounterState, "schemaVersion">): EncounterState {
  return {
    ...state,
    schemaVersion: ENCOUNTER_SCHEMA_VERSION,
    panelLayout: {
      left: [...state.panelLayout.left, { id: "zoneless", collapsed: false }],
      right: state.panelLayout.right
    }
  };
}
