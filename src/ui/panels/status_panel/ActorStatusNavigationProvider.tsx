import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@store/store";
import type { LayoutPoint } from "@core/layout/types";
import { useOptionalCanvasViewport } from "@ui/canvas/CanvasViewportContext";
import { subscribeToActorPlacementWorker } from "@ui/canvas/actors/actorPlacementWorkerClient";
import { getActorRenderPlacements } from "@ui/canvas/actors/actorCanvasLayout";
import { useCanvasEntityNavigation } from "@ui/canvas/useCanvasEntityNavigation";

type ActorNavigation = { points: Map<string, LayoutPoint>; navigate: (actorId: string) => void };
const Context = createContext<ActorNavigation | null>(null);

/** Uses the same derived placements as canvas rendering, including Zone-locked layouts. */
export function ActorStatusNavigationProvider({ children }: PropsWithChildren) {
  const [placementRevision, setPlacementRevision] = useState(0);
  useEffect(() => subscribeToActorPlacementWorker(() => setPlacementRevision((value) => value + 1)), []);
  const viewport = useOptionalCanvasViewport();
  const navigate = useCanvasEntityNavigation();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const points = useMemo(() => new Map(viewport ? getActorRenderPlacements(encounter)
    .map(({ actor, point }) => [actor.id, point] as const) : []), [encounter, Boolean(viewport), placementRevision]);
  const navigation = useMemo<ActorNavigation | null>(() => viewport ? {
    points,
    navigate: (id) => navigate("actor", id)
  } : null, [viewport, points, navigate]);
  return <Context.Provider value={navigation}>{children}</Context.Provider>;
}

export const useActorStatusNavigation = () => useContext(Context);
