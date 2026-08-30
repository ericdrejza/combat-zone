import type {
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
import { CANVAS_BACKGROUND_COLOR } from "./canvasConstants";
import type { LocalBoxSelectionState } from "./zones/zoneGeometry";
import { ZoneLayer } from "./zones/ZoneLayer";
import { EngagementLayer } from './engagements/EngagementLayer';
import type { ActorRenderPlacement } from "./actors/actorCanvasLayout";
import type { ActorPlacementTranslation } from "./actors/actorPlacementTranslation";
import { EdgeLayer } from "./edges/EdgeLayer";
import type { EdgePreset } from "@entities/edge/edgeMutations";
import { createCanvasMotionPointTransform } from "./canvasCoordinates";

type CanvasWorkspaceProps = {
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
    event: MouseEvent<SVGCircleElement>
  ) => void;
  onResizeHandleDrag: (point: LayoutPoint) => void;
  onResizeHandleDragEnd: (event: ActorDragEndEvent) => void;
  onZoneDrag: (point: LayoutPoint) => void;
  onZoneDragEnd: (event: ActorDragEndEvent) => void;
  onZoneMotionComplete: () => void;
  polygonDraftColor: string;
  selection: RootState["interaction"]["selection"];
  shapeDraft: ShapeDraftState | null;
  showFactionOutlines: boolean;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  zoneDraftPoints: LayoutPoint[];
  zoneShapeMode: RootState["interaction"]["zoneShapeMode"];
  zoneDrag: ZoneDragState | null;
};

export function CanvasWorkspace({
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
  zoneShapeMode,
  zoneActorTranslation,
  zoneDrag,
  onZoneDrag,
  onZoneDragEnd,
  onZoneMotionComplete
}: CanvasWorkspaceProps) {
  return (
    <MotionConfig transformPagePoint={createCanvasMotionPointTransform(canvasRef)}>
      <motion.svg
        aria-label="SVG encounter workspace"
        className={`h-full min-h-0 w-full bg-[${CANVAS_BACKGROUND_COLOR}]`}
        ref={(svg) => {
          canvasRef.current = svg;
        }}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
        // SVG zones and Motion-managed children can intercept native drag
        // events. Capture keeps the canvas the authoritative drop surface.
        onDragEnterCapture={handleCanvasDragOver}
        onDragOverCapture={handleCanvasDragOver}
        onDropCapture={handleCanvasDrop}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") {
            handleCanvasMouseDown(event);
          }
        }}
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") {
            handleCanvasMouseMove(event);
          }
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== "mouse") {
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
            {layer.id === "zones" ? (
              <ZoneLayer
                activeToolId={activeToolId}
                actorTargetZoneId={actorTargetZoneId}
                backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                directManipulationZoneId={directManipulationZoneId}
                encounter={encounter}
                getDisplayedPolygon={getDisplayedPolygon}
                onResizeHandleMouseDown={handleResizeHandleMouseDown}
                onResizeHandleDrag={onResizeHandleDrag}
                onResizeHandleDragEnd={onResizeHandleDragEnd}
                onZoneDrag={onZoneDrag}
                onZoneDragEnd={onZoneDragEnd}
                onZoneMotionComplete={onZoneMotionComplete}
                selection={selection}
                zoneDrag={zoneDrag}
              />
            ) : null}
            {layer.id === "edges" ? (
              <EdgeLayer
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
              <EngagementLayer activeToolId={activeToolId} actorDrag={actorDrag} backgroundLuminanceByZoneId={backgroundLuminanceByZoneId} encounter={encounter} engagementDrag={engagementDrag} onEngagementDrag={onEngagementDrag} onEngagementDragEnd={onEngagementDragEnd} onEngagementDragReturnComplete={onEngagementDragReturnComplete} onEngagementDragStart={onEngagementDragStart} onEngagementSelect={onEngagementSelect} placements={actorRenderPlacements} selection={selection} zoneActorTranslation={zoneActorTranslation} />
            ) : null}
            {layer.id === "actors" ? (
              <g
                className={
                  activeToolId === "zone" ? "pointer-events-none" : undefined
                }
              >
                <ActorLayer
                  activeToolId={activeToolId}
                  actorDrag={actorDrag}
                  placements={actorRenderPlacements}
                  zoneActorTranslation={zoneActorTranslation}
                  backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                  canvasBackgroundLuminance={canvasBackgroundLuminance}
                  encounter={encounter}
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
      </motion.svg>
    </MotionConfig>
  );
}
