import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { LayoutPoint } from "@core/layout/types";
import { POLYGON_LAYOUT_SETTINGS } from "@core/layout/polygonFlexLayout";
import { useAltKey } from "@hooks/useAltKey";
import type { AppDispatch, RootState } from "@store/store";
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
  EdgeDragState,
  ShapeDraftState,
  VertexDragState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { useEngagementDrag } from './engagements/useEngagementDrag';
import { type LocalBoxSelectionState } from "./zones/zoneGeometry";
import { useActorPaintBrush } from "./actors/useActorPaintBrush";
import { useCanvasDropHandlers } from "./handlers/useCanvasDropHandlers";
import { useCanvasInteractionHandlers } from "./handlers/useCanvasInteractionHandlers";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import {
  useCanvasBackgroundLuminance,
  usePolygonDraftBackgroundLuminance
} from "./useCanvasLuminance";
import { useDragActionPreview } from './useDragActionPreview';
import { getEdgeStatusSummary } from "./edges/edgeStatusSummary";

export function CanvasShell() {
  const dispatch = useDispatch<AppDispatch>();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const library = useSelector((state: RootState) => state.library);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
  );
  const actorTool = useSelector((state: RootState) => state.interaction.actorTool);
  const edgeTool = useSelector((state: RootState) => state.interaction.edgeTool);
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
  const [edgeDrag, setEdgeDrag] = useState<EdgeDragState | null>(null);
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
  const actorReturnCompletionRef = useRef({
    actorIds: new Set<string>(),
    key: ""
  });
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
  const {
    engagementDrag,
    handleEngagementDrag,
    handleEngagementDragEnd,
    handleEngagementDragReturnComplete,
    handleEngagementDragStart,
    handleEngagementSelect
  } = useEngagementDrag(dispatch, encounter, actorRenderPlacements);
  useDragActionPreview(dispatch, encounter, actorDrag, engagementDrag);
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
    edgeDrag,
    edgeTool,
    lastZoneOpacity,
    selection,
    setActorDrag,
    setBoxSelection,
    setEdgeDrag,
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
  const selectedEdgeStatuses =
    selection.selectedEntityType === "edge"
      ? selection.selectedIds
          .map((edgeId) => encounter.edges.byId[edgeId])
          .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge))
          .map((edge) => getEdgeStatusSummary(edge, encounter))
      : [];
  const isDraggingCanvasEntity = Boolean(
    actorDrag?.phase === "dragging" ||
      zoneDrag?.phase === "dragging" ||
      vertexDrag
  );

  function handleActorReturnComplete(actorId: string) {
    if (!actorDrag || actorDrag.phase !== "returning") {
      return;
    }

    const completionKey = `${actorDrag.actorId}:${actorDrag.actorIds.join(",")}:${actorDrag.start.x}:${actorDrag.start.y}`;

    if (actorReturnCompletionRef.current.key !== completionKey) {
      actorReturnCompletionRef.current = {
        actorIds: new Set<string>(),
        key: completionKey
      };
    }

    actorReturnCompletionRef.current.actorIds.add(actorId);

    if (
      actorDrag.actorIds.every((draggedActorId) =>
        actorReturnCompletionRef.current.actorIds.has(draggedActorId)
      )
    ) {
      setActorDrag(null);
    }
  }

  function resetActorReturnCompletion() {
    actorReturnCompletionRef.current = {
      actorIds: new Set<string>(),
      key: ""
    };
  }

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
        engagementDrag={engagementDrag}
        backgroundImage={backgroundImage}
        backgroundLuminanceByZoneId={backgroundLuminance.byZoneId}
        boxSelection={boxSelection}
        canvasBackgroundLuminance={backgroundLuminance.canvas}
        canvasRef={canvasRef}
        directManipulationZoneId={
          vertexDrag?.zoneId ?? zoneDrag?.zoneId ?? null
        }
        encounter={encounter}
        edgeDrag={edgeDrag}
        edgeTool={edgeTool}
        getDisplayedPolygon={getDisplayedPolygon}
        onActorDrag={handleActorDrag}
        onActorDragEnd={handleActorDragEnd}
        onActorDragStart={(...args) => {
          resetActorReturnCompletion();
          handleActorDragStart(...args);
        }}
        onActorIncomingPointCommitted={() =>
          setPlacementRevision((value) => value + 1)
        }
        onActorReturnComplete={handleActorReturnComplete}
        onEngagementDrag={handleEngagementDrag}
        onEngagementDragEnd={handleEngagementDragEnd}
        onEngagementDragReturnComplete={handleEngagementDragReturnComplete}
        onEngagementDragStart={handleEngagementDragStart}
        onEngagementSelect={handleEngagementSelect}
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
        edgeStatuses={selectedEdgeStatuses}
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
          encounter={encounter}
        />
      ) : null}
    </section>
  );
}
