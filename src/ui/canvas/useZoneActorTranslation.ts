import { useMemo } from "react";

import type { RootState } from "@store/store";
import type { ActorPlacementTranslation } from "./actors/actorPlacementTranslation";
import type { ZoneDragState } from "./canvasInteractionTypes";

/** Keeps actor overlays aligned with a zone only while its original polygon is dragging. */
export function useZoneActorTranslation(
  encounter: RootState["encounter"]["present"],
  zoneDrag: ZoneDragState | null
) {
  return useMemo<ActorPlacementTranslation | null>(() => {
    if (!zoneDrag) {
      return null;
    }

    const zone = encounter.zones.byId[zoneDrag.zoneId];

    // Once committed, cached placement geometry already contains translated points.
    if (!zone || zone.polygon !== zoneDrag.originalPolygon) {
      return null;
    }

    return {
      offset: {
        x: zoneDrag.current.x - zoneDrag.start.x,
        y: zoneDrag.current.y - zoneDrag.start.y
      },
      zoneId: zoneDrag.zoneId
    };
  }, [encounter, zoneDrag]);
}
