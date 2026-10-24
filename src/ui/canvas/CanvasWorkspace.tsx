import { useZoneColorPreview } from "./zones/useZoneColorPreview";
import { actorSurfaceZones } from './actors/actorSurfaceZones';
import { ActorMovementOverlay } from './actors/ActorMovementOverlay';
import { RulerOverlay } from './ruler/RulerOverlay';
import { useMemo, useState } from 'react';
import { useCanvasColorSampler } from './color_sampler/useCanvasColorSampler';
import { buildCellGraph, traceCellRoute } from '@core/movement/cellTracer';
import { CLOSE_DISTANCE } from './canvasConstants';
import { useCanvasPaintCursor } from './useCanvasPaintCursor';
import { nearestGridVertex, pointDistance } from '@core/movement/gridTopology';
import { readCanvasPreferences } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { useDispatch, useSelector } from 'react-redux';
import { addGridCalibrationPoint, removeGridCalibrationPoint } from '@interaction/interactionState';
import { toSvgPoint } from './zones/zoneGeometry';
import { GridLayer } from './grid/GridLayer';
import { GridCalibrationMarkers } from './grid/GridCalibrationOverlay';
import type {
  ReactNode,
  DragEventHandler,
  MouseEvent,
  MouseEventHandler,
  PointerEvent as ReactPointerEvent
} from "react";
import { MotionConfig, motion } from "motion/react";

import type { LayoutPoint } from "@core/layout/types";
import type { Zone } from "@entities/zone/types";
import { RENDER_LAYERS } from "@core/rendering/types";
import type { RootState } from "@store/store";
import type {
  ActorDragEndEvent,
  ActorDragStartEvent,
  ActorDragState,
  EngagementDragState,
  EdgeDragState,
  ShapeDraftState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { ActorLayer } from "./actors/ActorLayer";
import { CanvasBackgroundLayer } from "./background/CanvasBackgroundLayer";
import { CanvasOverlays } from "./CanvasOverlays";
import type { LocalBoxSelectionState } from "./zones/zoneGeometry";
import { ZoneLayer } from "./zones/ZoneLayer";
import { EngagementLayer } from './engagements/EngagementLayer';
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";
import type { ActorPlacementTranslation } from "./actors/actorPlacementTranslation";
import { EdgeLayer } from "./edges/EdgeLayer";
import type { EdgePreset } from "@entities/edge/edgeMutations";
import { createCanvasMotionPointTransform } from "./canvasCoordinates";

type CanvasWorkspaceProps = {
  rotationPreview?: { zoneId: string; rotation: number; active: boolean };
  onZoneRotationCancel?: () => void;
  keyboardOverlay?: ReactNode;
  activeToolId: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  actorTargetZoneId: string | null;
  engagementDrag: EngagementDragState | null;
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  backgroundLuminanceByZoneId: Record<string, number>;
  boxSelection: LocalBoxSelectionState | null;
  canvasBackgroundLuminance: number;
  canvasRef: { current: SVGSVGElement | null };
  directManipulationZoneId: string | null;
  encounter: RootState["encounter"]["present"];
  edgeDrag: EdgeDragState | null;
  edgeTool: EdgePreset;
  actorRenderPlacements: ActorRenderPlacement[];
  zoneActorTranslation: ActorPlacementTranslation | null;
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  onActorDragStart: (
    actorId: string,
    point: LayoutPoint,
    event: ActorDragStartEvent
  ) => void;
  onActorDrag: (point: LayoutPoint) => void;
  onActorDragEnd: (event: ActorDragEndEvent) => void;
  onActorIncomingPointCommitted: (actorId: string) => void;
  onActorReturnComplete: (actorId: string) => void;
  onEngagementDrag: (point: LayoutPoint) => void;
  onEngagementDragEnd: () => void;
  onEngagementDragReturnComplete: () => void;
  onEngagementDragStart: (engagementId: string, point: LayoutPoint) => void;
  onEngagementSelect: (engagementId: string, toggle?: boolean) => void;
  handleCanvasClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasContextMenu: MouseEventHandler<SVGSVGElement>;
  handleCanvasDoubleClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasDragOver: DragEventHandler<SVGSVGElement>;
  handleCanvasDrop: DragEventHandler<SVGSVGElement>;
  handleCanvasMouseDown: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleCanvasMouseMove: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleCanvasMouseUp: (
    event: MouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>
  ) => void;
  handleResizeHandleMouseDown: (
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement> | ReactPointerEvent<SVGCircleElement>
  ) => number | undefined;
  onResizeHandleDrag: (point: LayoutPoint, gestureId?: number, timeStamp?: number) => void;
  onResizeHandleDragEnd: (event: ActorDragEndEvent, gestureId?: number) => void;
  onZoneMotionComplete: () => void;
  polygonDraftColor: string;
  selection: RootState["interaction"]["selection"];
  shapeDraft: ShapeDraftState | null;
  showFactionOutlines: boolean;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  zoneDraftPoints: LayoutPoint[];
  zoneOpacityPreview: RootState["interaction"]["zoneOpacityPreview"];
  zoneShapeMode: RootState["interaction"]["zoneShapeMode"];
  zoneDrag: ZoneDragState | null;
};

export function CanvasWorkspace({
  rotationPreview, onZoneRotationCancel,
  keyboardOverlay,
  activeToolId,
  actorDrag,
  actorRenderPlacements,
  actorTargetZoneId,
  engagementDrag,
  backgroundImage,
  backgroundLuminanceByZoneId,
  boxSelection,
  canvasBackgroundLuminance,
  canvasRef,
  directManipulationZoneId,
  encounter,
  edgeDrag,
  edgeTool,
  getDisplayedPolygon,
  onActorDrag,
  onActorDragEnd,
  onActorDragStart,
  onActorIncomingPointCommitted,
  onActorReturnComplete,
  onEngagementDrag,
  onEngagementDragEnd,
  onEngagementDragReturnComplete,
  onEngagementDragStart,
  onEngagementSelect,
  handleCanvasClick,
  handleCanvasContextMenu,
  handleCanvasDoubleClick,
  handleCanvasDragOver,
  handleCanvasDrop,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleResizeHandleMouseDown,
  onResizeHandleDrag,
  onResizeHandleDragEnd,
  onActorMouseEnter,
  onActorMouseLeave,
  polygonDraftColor,
  selection,
  shapeDraft,
  showFactionOutlines,
  zoneDraftPoints,
  zoneOpacityPreview,
  zoneShapeMode,
  zoneActorTranslation,
  zoneDrag,
  onZoneMotionComplete
}: CanvasWorkspaceProps) {
  const appearanceEncounter = useZoneColorPreview(encounter);
  const paintCursorClass = useCanvasPaintCursor();
  const colorSampler = useCanvasColorSampler(encounter);
  const dispatch = useDispatch();
  const namePreview = useSelector((state: RootState) => state.interaction.namePreview);
  const tracing = useSelector((state: RootState) => state.interaction.cellTracerActive);
  const [rulerHitTarget, setRulerHitTarget] = useState<SVGGElement | null>(null);
  const [tracerPointer, setTracerPointer] = useState<LayoutPoint | null>(null);
  const tracerGraph = useMemo(() => tracing ? buildCellGraph(encounter) : undefined, [tracing, encounter.grid, encounter.canvasSize]);
  const tracerTarget = tracerPointer ? nearestGridVertex(encounter, tracerPointer) : null;
  const closingTracer = !!tracerTarget && zoneDraftPoints.length >= 3 && pointDistance(tracerTarget, zoneDraftPoints[0]) <= CLOSE_DISTANCE;
  const tracerPreview = tracing && tracerTarget && zoneDraftPoints.length && tracerGraph ? traceCellRoute(encounter, zoneDraftPoints[zoneDraftPoints.length - 1], closingTracer ? zoneDraftPoints[0] : tracerTarget, zoneDraftPoints, readCanvasPreferences().tracerInvalidRoute, closingTracer, tracerGraph) : null;
  const calibrating = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  // Changing this callback invalidates Motion context for every canvas element.
  // The transform reads the current SVG geometry through the ref when invoked.
  const transformPagePoint = useMemo(() => createCanvasMotionPointTransform(canvasRef), [canvasRef]);
  return (
    <MotionConfig transformPagePoint={transformPagePoint}>
      <motion.svg
        aria-label="SVG encounter workspace"
        className={`h-full min-h-0 w-full bg-canvas-panel${paintCursorClass}`}
        ref={(svg) => {
          canvasRef.current = svg;
        }}
        onClickCapture={event => {
          if (colorSampler.active) { colorSampler.captureClick(event); return; }
          if (calibrating) { event.stopPropagation(); dispatch(addGridCalibrationPoint(toSvgPoint(event, event.currentTarget))); }
        }}
        onClick={handleCanvasClick}
        onContextMenu={event => { if (colorSampler.captureContextMenu(event)) return; if (calibrating) { event.preventDefault(); dispatch(removeGridCalibrationPoint()); } else handleCanvasContextMenu(event); }}
        onMouseDownCapture={colorSampler.captureDown}
        onPointerDownCapture={colorSampler.captureDown}
        // SVG zones and Motion-managed children can intercept native drag
        // events. Capture keeps the canvas the authoritative drop surface.
        onDragEnterCapture={handleCanvasDragOver}
        onDragOverCapture={handleCanvasDragOver}
        onDropCapture={handleCanvasDrop}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={calibrating ? undefined : handleCanvasMouseDown}
        onMouseMove={event => { if (tracing) setTracerPointer(toSvgPoint(event, event.currentTarget)); handleCanvasMouseMove(event); }}
        onMouseUp={handleCanvasMouseUp}
        onPointerDown={(event) => {
          if (!calibrating && event.pointerType !== "mouse") {
            handleCanvasMouseDown(event);
          }
        }}
        onPointerMove={(event) => {
          if (!calibrating && event.pointerType !== "mouse") {
            handleCanvasMouseMove(event);
          }
        }}
        onPointerUp={(event) => {
          if (!calibrating && event.pointerType !== "mouse") {
            handleCanvasMouseUp(event);
          }
        }}
        role="img"
        viewBox={`0 0 ${encounter.canvasSize.width} ${encounter.canvasSize.height}`}
      >
        {RENDER_LAYERS.map((layer) => (
          <g
            key={layer.id}
            aria-label={`${layer.label} layer`}
            data-layer={layer.id}
          >
            {layer.id === "background" ? (
              <CanvasBackgroundLayer
                backgroundImage={backgroundImage}
                canvasSize={encounter.canvasSize}
              />
            ) : null}
            {layer.id === "grid" ? <GridLayer encounter={encounter} /> : null}
            {layer.id === "zones" ? (
              <ZoneLayer
                rotationPreview={rotationPreview} onZoneRotationCancel={onZoneRotationCancel}
                activeToolId={activeToolId}
                actorTargetZoneId={actorTargetZoneId}
                backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                directManipulationZoneId={directManipulationZoneId}
                encounter={appearanceEncounter}
                getDisplayedPolygon={getDisplayedPolygon}
                onResizeHandleMouseDown={handleResizeHandleMouseDown}
                onResizeHandleDrag={onResizeHandleDrag}
                onResizeHandleDragEnd={onResizeHandleDragEnd}
                onZoneMotionComplete={onZoneMotionComplete}
                selection={selection}
                zoneDrag={zoneDrag}
                zoneOpacityPreview={zoneOpacityPreview}
              />
            ) : null}
            {layer.id === "edges" ? (
              <EdgeLayer
                zoneEditPending={zoneDrag?.phase === "validating"}
                directManipulationZoneId={directManipulationZoneId}
                activeToolId={activeToolId}
                edgeDrag={edgeDrag}
                edgeTool={edgeTool}
                encounter={encounter}
                canvasBackgroundLuminance={canvasBackgroundLuminance}
                getDisplayedPolygon={getDisplayedPolygon}
                selection={selection}
              />
            ) : null}
            {layer.id === 'engagements' ? (
              <EngagementLayer activeToolId={activeToolId} actorDrag={actorDrag} backgroundLuminanceByZoneId={backgroundLuminanceByZoneId} encounter={appearanceEncounter} engagementDrag={engagementDrag} onEngagementDrag={onEngagementDrag} onEngagementDragEnd={onEngagementDragEnd} onEngagementDragReturnComplete={onEngagementDragReturnComplete} onEngagementDragStart={onEngagementDragStart} onEngagementSelect={onEngagementSelect} placements={actorRenderPlacements} selection={selection} zoneActorTranslation={zoneActorTranslation} />
            ) : null}
            {layer.id === "actors" ? (
              <g
                className={
                  activeToolId === "zone" ? "pointer-events-none" : undefined
                }
              >
                <g ref={setRulerHitTarget} aria-label="Ruler hit targets" className="outline-none" />
                <ActorLayer namePreview={namePreview}
                  surfaceZones={actorSurfaceZones(appearanceEncounter.zones, getDisplayedPolygon, zoneDrag, zoneOpacityPreview)}
                  activeToolId={calibrating ? "background" : activeToolId}
                  actorDrag={actorDrag}
                  placements={actorRenderPlacements}
                  zoneActorTranslation={zoneActorTranslation}
                  backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                  canvasBackgroundLuminance={canvasBackgroundLuminance}
                  encounter={appearanceEncounter}
                  onActorDrag={onActorDrag}
                  onActorDragEnd={onActorDragEnd}
                  onActorDragStart={onActorDragStart}
                  onIncomingPointCommitted={onActorIncomingPointCommitted}
                  onActorReturnComplete={onActorReturnComplete}
                  onActorMouseEnter={onActorMouseEnter}
                  onActorMouseLeave={onActorMouseLeave}
                  selection={selection}
                  showFactionOutlines={showFactionOutlines}
                />
              </g>
            ) : null}
            {layer.id === "uiOverlays" ? (
              <CanvasOverlays
                boxSelection={boxSelection}
                polygonDraftColor={polygonDraftColor}
                shapeDraft={shapeDraft}
                zoneDraftPoints={zoneDraftPoints}
                zoneShapeMode={zoneShapeMode}
              />
            ) : null}
          </g>
        ))}
        {calibrating ? <GridCalibrationMarkers /> : null}
        {tracerPreview ? <polyline data-cell-tracer-preview points={tracerPreview.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={polygonDraftColor} strokeWidth={2} strokeDasharray="6 4" pointerEvents="none" /> : null}
        <ActorMovementOverlay encounter={encounter} drag={actorDrag} />
        {keyboardOverlay}
        <RulerOverlay encounter={encounter} hitTarget={rulerHitTarget} placements={actorRenderPlacements} actorDrag={actorDrag} zoneActorTranslation={zoneActorTranslation} />
      </motion.svg>
    </MotionConfig>
  );
}
