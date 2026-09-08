import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import type { LayoutPoint } from "@core/layout/types";
import { useAltKey } from "@hooks/useAltKey";
import { useCompactLayout } from "@hooks/useCompactLayout";
import { useMobileControls } from "@hooks/useMobileControls";
import { deleteSelectedEntities } from "@interaction/selection/deleteSelectedEntities";
import type { AppDispatch, RootState } from "@store/store";
import { ZonelessActorPanel } from "../panels/zoneless_actors/ZonelessActorPanel";
import { closeZoneShapeMenu } from "../toolbar/events";
import { CanvasDragOverlay } from "./CanvasDragOverlay";
import { CanvasToolStatusBadge } from "./CanvasToolStatusBadge";
import { CompactEngagementActionButtons } from "./CompactEngagementActionButtons";
import { CompactSelectionDeleteButton } from "./CompactSelectionDeleteButton";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { CanvasTransferPreview } from "./CanvasTransferPreview";
import { CanvasViewport } from "./CanvasViewport";
import { getTextColorForLuminance } from "./canvasLuminance";
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
import { getCanvasStatus } from "./canvasStatus";
import { useActorReturnCompletion } from "./useActorReturnCompletion";
import { useZoneActorTranslation } from "./useZoneActorTranslation";
import { useActorRenderPlacements } from "./actors/useActorRenderPlacements";
import { useCompactCanvasTransfer } from "./useCompactCanvasTransfer";
import { TOUCH_NAVIGATION_START_EVENT } from "./useCanvasTouchGestures";
import { TouchSelectionToggle } from "@ui/toolbar/TouchSelectionToggle";
import {
  CompactPanelLauncher,
  type CompactPanelLauncherProps
} from "@ui/panels/CompactPanelLauncher";
import type { CompactPanelDefinition } from "@ui/panels/compactPanelMetadata";

type CanvasShellProps = {
  compactPanels?: readonly CompactPanelDefinition[];
  renderCompactPanelContent?: CompactPanelLauncherProps["renderPanelContent"];
  renderCompactPanelHeaderActions?: CompactPanelLauncherProps["renderPanelHeaderActions"];
};

export function CanvasShell({
  compactPanels,
  renderCompactPanelContent,
  renderCompactPanelHeaderActions
}: CanvasShellProps) {
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
  const touchMultiSelect = useSelector(
    (state: RootState) => state.interaction.touchMultiSelect
  );
  const compactLayout = useCompactLayout();
  const showMobileControls = useMobileControls(compactLayout);
  const [actorDrag, setActorDrag] = useState<ActorDragState | null>(null);
  const [edgeDrag, setEdgeDrag] = useState<EdgeDragState | null>(null);
  const [hoveredActorId, setHoveredActorId] = useState<string | null>(null);
  const [zoneDraftPoints, setZoneDraftPoints] = useState<LayoutPoint[]>([]);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const [boxSelection, setBoxSelection] = useState<LocalBoxSelectionState | null>(
    null
  );
  const [canvasShellElement, setCanvasShellElement] =
    useState<HTMLElement | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickUnconditionallyRef = useRef(false);
  const suppressNextCanvasClickPointRef = useRef<LayoutPoint | null>(null);
  const suppressNextEntityClickRef = useRef<string | null>(null);
  const altKeyDown = useAltKey();
  const compactTransferPreview = useCompactCanvasTransfer({
    activeToolId,
    actorTool,
    canvasRef,
    dispatch,
    encounter,
    library
  });
  const backgroundImage = encounter.backgroundImage;
  const { placements: actorRenderPlacements, refreshPlacements } =
    useActorRenderPlacements(encounter);
  const {
    engagementDrag,
    handleEngagementDrag,
    handleEngagementDragEnd,
    handleEngagementDragReturnComplete,
    handleEngagementDragStart,
    handleEngagementSelect
  } = useEngagementDrag(dispatch, encounter, actorRenderPlacements);
  useDragActionPreview(dispatch, encounter, actorDrag, engagementDrag);
  const zoneActorTranslation = useZoneActorTranslation(encounter, zoneDrag);
  const backgroundLuminance = useCanvasBackgroundLuminance(
    backgroundImage,
    encounter.zones,
    encounter.canvasSize
  );
  const polygonDraftBackgroundLuminance = usePolygonDraftBackgroundLuminance(
    backgroundImage,
    zoneDraftPoints,
    encounter.canvasSize
  );

  useEffect(() => {
    const cancelEditingForTouchNavigation = () => {
      setActorDrag(null);
      setBoxSelection(null);
      setEdgeDrag(null);
      setShapeDraft(null);
      setVertexDrag(null);
      setZoneDrag(null);
      setZoneDraftPoints([]);
      suppressNextCanvasClickUnconditionallyRef.current = true;
    };
    window.addEventListener(
      TOUCH_NAVIGATION_START_EVENT,
      cancelEditingForTouchNavigation
    );
    return () =>
      window.removeEventListener(
        TOUCH_NAVIGATION_START_EVENT,
        cancelEditingForTouchNavigation
      );
  }, []);

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
    zoneShapeMode,
    touchMultiSelect
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
  const canvasStatus = getCanvasStatus(encounter, selection, hoveredActorId);
  const isDraggingCanvasEntity = Boolean(
    actorDrag?.phase === "dragging" ||
      zoneDrag?.phase === "dragging" ||
      vertexDrag
  );

  const { handleActorReturnComplete, resetActorReturnCompletion } =
    useActorReturnCompletion(actorDrag, () => setActorDrag(null));

  return (
    <section
      aria-label="Encounter canvas"
      className={`relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm ${
        isDraggingCanvasEntity ? "select-none" : ""
      }`}
      ref={setCanvasShellElement}
      role="main"
    >
      <CanvasViewport canvasSize={encounter.canvasSize}>
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
        onActorDragStart={(actorId, point, event) => {
          resetActorReturnCompletion();
          handleActorDragStart(actorId, point, {
            ...event,
            touchMultiSelect
          });
        }}
        onActorIncomingPointCommitted={refreshPlacements}
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
        {actorDrag ? (
          <CanvasDragOverlay
            actorDrag={actorDrag}
            actorRenderPlacements={actorRenderPlacements}
            canvasSize={encounter.canvasSize}
            encounter={encounter}
          />
        ) : null}
      </CanvasViewport>
      <CanvasToolStatusBadge
        activeToolId={activeToolId}
        actorNames={canvasStatus.actorNames}
        edgeStatuses={canvasStatus.edgeStatuses}
        zoneStatuses={canvasStatus.zoneStatuses}
        zoneShapeMode={zoneShapeMode}
      />
      {showMobileControls ? (
        <div className="absolute bottom-3 left-2 right-2 flex items-end gap-2">
          <div className="relative z-30 flex shrink-0 items-center gap-2">
            <TouchSelectionToggle toolId={activeToolId} />
            <CompactSelectionDeleteButton
              activeToolId={activeToolId}
              inline
              onDelete={() => deleteSelectedEntities(dispatch, encounter, selection)}
              selection={selection}
            />
            <CompactEngagementActionButtons
              activeToolId={activeToolId}
              encounter={encounter}
              selection={selection}
            />
          </div>
          {!compactLayout ? (
            <div className="relative z-30 flex min-w-0 flex-1 justify-center">
              <ZonelessActorPanel
                activeToolId={activeToolId}
                actors={encounter.actors}
                canvasBackgroundLuminance={backgroundLuminance.canvas}
                isActorDragActive={Boolean(actorDrag?.hasMoved)}
                isInBottomRow
                onActorCreationDragOver={handleActorCreationDragOverZoneless}
                onActorCreationDrop={handleActorCreationDropToZoneless}
                selection={selection}
              />
            </div>
          ) : null}
          {compactLayout ? (
            <div className="relative z-50 ml-auto shrink-0">
              <CompactPanelLauncher
                inline
                overlayContainer={canvasShellElement}
                panels={compactPanels}
                renderPanelContent={renderCompactPanelContent}
                renderPanelHeaderActions={renderCompactPanelHeaderActions}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {!compactLayout && !showMobileControls ? (
        <ZonelessActorPanel
          activeToolId={activeToolId}
          actors={encounter.actors}
          canvasBackgroundLuminance={backgroundLuminance.canvas}
          isActorDragActive={Boolean(actorDrag?.hasMoved)}
          onActorCreationDragOver={handleActorCreationDragOverZoneless}
          onActorCreationDrop={handleActorCreationDropToZoneless}
          selection={selection}
        />
      ) : null}
      {compactTransferPreview ? (
        <CanvasTransferPreview preview={compactTransferPreview} />
      ) : null}
    </section>
  );
}
