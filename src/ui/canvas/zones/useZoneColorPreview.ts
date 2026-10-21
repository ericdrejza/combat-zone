import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import type { EncounterState } from "@core/encounter/types";

/** Only visual layers receive these colors; commands and persistence retain the canonical encounter. */
export function useZoneColorPreview(encounter: EncounterState): EncounterState {
  const preview = useSelector((state: RootState) => state.interaction.zoneColorPreview);
  return useMemo(() => {
    const zone = preview && encounter.zones.byId[preview.zoneId];
    if (!zone || !preview) return encounter;
    return { ...encounter, zones: { ...encounter.zones,
      byId: { ...encounter.zones.byId, [zone.id]: { ...zone, [preview.property]: preview.color } } } };
  }, [encounter, preview]);
}
