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
} from "./actors/actorCanvasLayout";
import { calculateNonSplitZonePlacementGeometry } from "./actors/actorNonSplitLayout";
import {
  scheduleProactiveActorPlacementComputations
} from "./actors/proactiveActorPlacementCache";
import { subscribeToActorPlacementWorker } from "./actors/actorPlacementWorkerClient";
import type { ActorPlacementTranslation } from "./actors/actorPlacementTranslation";
import type {
  ActorDragState,
  ShapeDraftState,
  VertexDragState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { type LocalBoxSelectionState } from "./zones/zoneGeometry";
import { useActorPaintBrush } from "./actors/useActorPaintBrush";
import { useCanvasDropHandlers } from "./handlers/useCanvasDropHandlers";
import { useCanvasInteractionHandlers } from "./handlers/useCanvasInteractionHandlers";
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
    handleActorDrag,
    handleActorDragEnd,
    handleActorDragStart,
    handleResizeHandleDrag,
    handleResizeHandleDragEnd,
    handleResizeHandleMouseDown,
    handleZoneDrag,
    handleZoneDragEnd
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
    handleActorCreationDragOverZoneless,
    handleActorCreationDropToZoneless,
    handleCanvasDragOver,
    handleCanvasDrop
  } = useCanvasDropHandlers({
    activeToolId,
    actorTool,
    dispatch,
    encounter,
    library
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
  const selectedZoneStatuses =
    selection.selectedEntityType === "zone"
      ? selection.selectedIds
          .map((zoneId) => encounter.zones.byId[zoneId])
          .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone))
          .map((zone) =>
            zone.tags.length > 0
              ? `${zone.name}: ${zone.tags.join(", ")}`
              : zone.name
          )
      : [];
  const isDraggingCanvasEntity = Boolean(
    actorDrag?.phase === "dragging" ||
      zoneDrag?.phase === "dragging" ||
      vertexDrag
  );

  return (
    <section
      aria-label="Encounter canvas"
      className={`relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm ${
        isDraggingCanvasEntity ? "select-none" : ""
      }`}
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
        directManipulationZoneId={
          vertexDrag?.zoneId ?? zoneDrag?.zoneId ?? null
        }
        encounter={encounter}
        getDisplayedPolygon={getDisplayedPolygon}
        onActorDrag={handleActorDrag}
        onActorDragEnd={handleActorDragEnd}
        onActorDragStart={handleActorDragStart}
        onActorReturnComplete={() => setActorDrag(null)}
        handleCanvasClick={handleCanvasClick}
        handleCanvasContextMenu={handleCanvasContextMenu}
        handleCanvasDoubleClick={handleCanvasDoubleClick}
        handleCanvasDragOver={handleCanvasDragOver}
        handleCanvasDrop={handleCanvasDrop}
        handleCanvasMouseDown={handleCanvasMouseDown}
        handleCanvasMouseMove={handleCanvasMouseMove}
        handleCanvasMouseUp={handleCanvasMouseUp}
        handleResizeHandleMouseDown={handleResizeHandleMouseDown}
        onResizeHandleDrag={handleResizeHandleDrag}
        onResizeHandleDragEnd={handleResizeHandleDragEnd}
        onZoneDrag={handleZoneDrag}
        onZoneDragEnd={handleZoneDragEnd}
        onZoneMotionComplete={() => setZoneDrag(null)}
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
        zoneDrag={zoneDrag}
      />
      <CanvasToolStatusBadge
        activeToolId={activeToolId}
        actorNames={statusActorNames}
        zoneStatuses={selectedZoneStatuses}
        zoneShapeMode={zoneShapeMode}
      />
      <ZonelessActorPanel
        activeToolId={activeToolId}
        actors={encounter.actors}
        canvasBackgroundLuminance={backgroundLuminance.canvas}
        isActorDragActive={Boolean(actorDrag?.hasMoved)}
        onActorCreationDragOver={handleActorCreationDragOverZoneless}
        onActorCreationDrop={handleActorCreationDropToZoneless}
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
