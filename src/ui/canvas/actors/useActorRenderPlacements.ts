import { useCallback, useEffect, useMemo, useState } from "react";

import { POLYGON_LAYOUT_SETTINGS } from "@core/layout/polygonFlexLayout";
import type { RootState } from "@store/store";
import {
  ACTOR_LAYOUT_COMPUTATION_STRATEGY,
  getActorRenderPlacements
} from "./actorCanvasLayout";
import { calculateNonSplitZonePlacementGeometry } from "./actorNonSplitLayout";
import { scheduleProactiveActorPlacementComputations } from "./proactiveActorPlacementCache";
import { subscribeToActorPlacementWorker } from "./actorPlacementWorkerClient";

/** Owns worker-backed actor placement revisions and proactive cache scheduling. */
export function useActorRenderPlacements(
  encounter: RootState["encounter"]["present"]
) {
  const [placementRevision, setPlacementRevision] = useState(0);
  const refreshPlacements = useCallback(
    () => setPlacementRevision((value) => value + 1),
    []
  );

  useEffect(() => subscribeToActorPlacementWorker(refreshPlacements), [refreshPlacements]);
  useEffect(() => {
    if (ACTOR_LAYOUT_COMPUTATION_STRATEGY === "PROACTIVE") {
      scheduleProactiveActorPlacementComputations(
        encounter,
        POLYGON_LAYOUT_SETTINGS,
        calculateNonSplitZonePlacementGeometry
      );
    }
  }, [encounter]);

  const placements = useMemo(
    () => getActorRenderPlacements(encounter, ACTOR_LAYOUT_COMPUTATION_STRATEGY),
    [encounter, placementRevision]
  );

  return { placements, refreshPlacements };
}
