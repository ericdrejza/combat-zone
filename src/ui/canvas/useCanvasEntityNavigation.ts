import { useCallback } from "react";
import { useStore } from "react-redux";
import type { RootState } from "@store/store";
import { polygonCentroid } from "@core/movement/zoneMembership";
import { getActorRenderPlacements } from "./actors/actorCanvasLayout";
import { useOptionalCanvasViewport } from "./CanvasViewportContext";
import { actorGroupNavigationPoint } from "./actorGroupNavigation";

/** Navigate to current canvas geometry, sharing Status image behavior and preserving zoom. */
export function useCanvasEntityNavigation() {
  const store = useStore<RootState>();
  const viewport = useOptionalCanvasViewport();
  return useCallback((kind: "actor" | "zone", id: string | readonly string[]) => {
    if (!viewport) return;
    const encounter = store.getState().encounter.present;
    if (typeof id !== "string") {
      if (kind !== "actor") return;
      const ids = new Set(id);
      const placements = getActorRenderPlacements(encounter).filter(placement => ids.has(placement.actor.id));
      if (placements.length !== ids.size) return;
      const center = actorGroupNavigationPoint(placements, viewport.getViewportSize(), viewport.zoom);
      if (center) viewport.panToPoint(center, { animate: true });
      return;
    }
    const point = kind === "actor"
      ? getActorRenderPlacements(encounter).find(placement => placement.actor.id === id)?.point
      : encounter.zones.byId[id]?.polygon.length ? polygonCentroid(encounter.zones.byId[id].polygon) : undefined;
    if (point) viewport.panToPoint(point, { animate: true });
  }, [store, viewport]);
}
