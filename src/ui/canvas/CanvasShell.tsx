import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { LayoutPoint } from "@core/layout/types";
import { POLYGON_LAYOUT_SETTINGS } from "@core/layout/polygonFlexLayout";
import { useAltKey } from "@hooks/useAltKey";
import type { RootState } from "@store/store";
import { ZonelessActorPanel } from "../panels/zoneless_actors/ZonelessActorPanel";
import { closeZoneShapeMenu } from "../toolbar/events";
import { CanvasDragOverlay } from "./CanvasDragOverlay";
import { CanvasToolStatusBadge } from "./CanvasToolStatusBadge";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { getTextColorForLuminance } from "./canvasLuminance";
import {
  ACTOR_LAYOUT_COMPUTATION_STRATEGY,
  getActorRenderPlacements
} from "./actorCanvasLayout";
import { calculateNonSplitZonePlacementGeometry } from "./actorNonSplitLayout";
import {
  scheduleProactiveActorPlacementComputations
} from "./proactiveActorPlacementCache";
import { subscribeToActorPlacementWorker } from "./actorPlacementWorkerClient";
import type { ActorPlacementTranslation } from "./actorPlacementTranslation";
import type {
  ActorDragState,
  ShapeDraftState,
  VertexDragState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { type LocalBoxSelectionState } from "./zoneGeometry";
import { useActorPaintBrush } from "./useActorPaintBrush";
import { useCanvasDropHandlers } from "./useCanvasDropHandlers";
import { useCanvasInteractionHandlers } from "./useCanvasInteractionHandlers";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import {
  useCanvasBackgroundLuminance,
  usePolygonDraftBackgroundLuminance
} from "./useCanvasLuminance";

export function CanvasShell() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const actorPaintBrush = useSelector(
    (state: RootState) => state.interaction.actorPaintBrush
  );
  const zoneShapeMode = useSelector(
    (state: RootState) => state.interaction.zoneShapeMode
  );
  const zonePaintBrush = useSelector(
    (state: RootState) => state.interaction.zonePaintBrush
  );
  const lastZoneOpacity = useSelector(
    (state: RootState) => state.interaction.lastZoneOpacity
  );
  const selection = useSelector((state: RootState) => state.interaction.selection);
  const [actorDrag, setActorDrag] = useState<ActorDragState | null>(null);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [zoneDraftPoints, setZoneDraftPoints] = useState<LayoutPoint[]>([]);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const [placementRevision, setPlacementRevision] = useState(0);
  const [boxSelection, setBoxSelection] = useState<LocalBoxSelectionState | null>(
    null
  );
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickUnconditionallyRef = useRef(false);
  const suppressNextCanvasClickPointRef = useRef<LayoutPoint | null>(null);
  const suppressNextEntityClickRef = useRef<string | null>(null);
  const altKeyDown = useAltKey();
  const backgroundImage = encounter.backgroundImage;
  useEffect(
    () => subscribeToActorPlacementWorker(() => setPlacementRevision((value) => value + 1)),
    []
  );
  const actorRenderPlacements = useMemo(
    () => getActorRenderPlacements(encounter, ACTOR_LAYOUT_COMPUTATION_STRATEGY),
    [encounter, placementRevision]
  );
  useEffect(() => {
    if (ACTOR_LAYOUT_COMPUTATION_STRATEGY !== "PROACTIVE") {
      return;
    }

    scheduleProactiveActorPlacementComputations(
      encounter,
      POLYGON_LAYOUT_SETTINGS,
      calculateNonSplitZonePlacementGeometry
    );
  }, [encounter]);
  const zoneActorTranslation = useMemo<ActorPlacementTranslation | null>(() => {
    if (!zoneDrag) {
      return null;
    }

    const zone = encounter.zones.byId[zoneDrag.zoneId];

    // Once the mutation commits, the polygon is no longer the original drag
    // polygon. The cached geometry already contains the translated positions.
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
  const backgroundLuminance = useCanvasBackgroundLuminance(
    backgroundImage,
    encounter.zones
  );
  const polygonDraftBackgroundLuminance = usePolygonDraftBackgroundLuminance(
    backgroundImage,
    zoneDraftPoints
  );

  useCanvasKeyboard({
    activeToolId,
    actorPaintBrush,
    actorTool,
    clearShapeDraft: () => setShapeDraft(null),
    clearZoneDraftPoints: () => setZoneDraftPoints([]),
    closeZoneShapeMenu,
    dispatch,
    encounter,
    selection,
    zonePaintBrush
  });

  useActorPaintBrush({
    actorPaintBrush,
    actorTool,
    dispatch,
    encounter,
    selection
  });

  const {
    getDisplayedPolygon,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleActorMouseDown,
    handleResizeHandleMouseDown
  } = useCanvasInteractionHandlers({
    activeToolId,
    actorDrag,
    actorRenderPlacements,
    actorPaintBrush,
    actorTool,
    boxSelection,
    canvasRef,
    dispatch,
    encounter,
    lastZoneOpacity,
    selection,
    setActorDrag,
    setBoxSelection,
    setShapeDraft,
    setVertexDrag,
    setZoneDraftPoints,
    setZoneDrag,
    shapeDraft,
    suppressNextCanvasClickPointRef,
    suppressNextCanvasClickRef,
    suppressNextCanvasClickUnconditionallyRef,
    suppressNextEntityClickRef,
    vertexDrag,
    zoneDraftPoints,
    zoneDrag,
    zonePaintBrush,
    zoneShapeMode
  });

  const {
    handleActorDropToZoneless,
    handleCanvasDragOver,
    handleCanvasDrop
  } = useCanvasDropHandlers({
    activeToolId,
    actorDrag,
    actorTool,
    dispatch,
    encounter,
    library,
    setActorDrag
  });

  const polygonDraftColor = getTextColorForLuminance(
    polygonDraftBackgroundLuminance
  );
  const showFactionOutlines =
    altKeyDown && (activeToolId === "actor" || activeToolId === "select");
  const selectedActorNames =
    selection.selectedEntityType === "actor"
      ? selection.selectedIds
          .map((actorId) => encounter.actors.byId[actorId]?.name)
          .filter((name): name is string => Boolean(name))
          .sort((left, right) => left.localeCompare(right))
      : [];
  const hoveredActorName = hoveredActorId
    ? encounter.actors.byId[hoveredActorId]?.name
    : undefined;
  const statusActorNames =
    selectedActorNames.length > 0
      ? selectedActorNames
      : hoveredActorName
        ? [hoveredActorName]
        : [];

  return (
    <section
      aria-label="Encounter canvas"
      className="relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <CanvasWorkspace
        activeToolId={activeToolId}
        actorDrag={actorDrag}
        actorRenderPlacements={actorRenderPlacements}
        zoneActorTranslation={zoneActorTranslation}
        actorTargetZoneId={actorTool.targetZoneId}
        backgroundImage={backgroundImage}
        backgroundLuminanceByZoneId={backgroundLuminance.byZoneId}
        boxSelection={boxSelection}
        canvasBackgroundLuminance={backgroundLuminance.canvas}
        canvasRef={canvasRef}
        encounter={encounter}
        getDisplayedPolygon={getDisplayedPolygon}
        handleActorMouseDown={handleActorMouseDown}
        handleCanvasClick={handleCanvasClick}
        handleCanvasContextMenu={handleCanvasContextMenu}
        handleCanvasDoubleClick={handleCanvasDoubleClick}
        handleCanvasDragOver={handleCanvasDragOver}
        handleCanvasDrop={handleCanvasDrop}
        handleCanvasMouseDown={handleCanvasMouseDown}
        handleCanvasMouseMove={handleCanvasMouseMove}
        handleCanvasMouseUp={handleCanvasMouseUp}
        handleResizeHandleMouseDown={handleResizeHandleMouseDown}
        onActorMouseEnter={setHoveredActorId}
        onActorMouseLeave={(actorId) =>
          setHoveredActorId((current) =>
            current === actorId ? null : current
          )
        }
        polygonDraftColor={polygonDraftColor}
        selection={selection}
        shapeDraft={shapeDraft}
        showFactionOutlines={showFactionOutlines}
        zoneDraftPoints={zoneDraftPoints}
        zoneShapeMode={zoneShapeMode}
      />
      <CanvasToolStatusBadge
        activeToolId={activeToolId}
        actorNames={statusActorNames}
        zoneShapeMode={zoneShapeMode}
      />
      <ZonelessActorPanel
        activeToolId={activeToolId}
        actors={encounter.actors}
        canvasBackgroundLuminance={backgroundLuminance.canvas}
        isActorDragActive={Boolean(actorDrag?.hasMoved)}
        onActorDropToZoneless={handleActorDropToZoneless}
        selection={selection}
      />
      {actorDrag ? (
        <CanvasDragOverlay
          actorDrag={actorDrag}
          actorRenderPlacements={actorRenderPlacements}
          backgroundLuminanceByZoneId={backgroundLuminance.byZoneId}
          canvasBackgroundLuminance={backgroundLuminance.canvas}
          encounter={encounter}
          selection={selection}
          showFactionOutlines={showFactionOutlines}
        />
      ) : null}
    </section>
  );
}
