import type {
  DragEventHandler,
  MouseEvent,
  MouseEventHandler
} from "react";

import type { LayoutPoint } from "../../core/layout/types";
import type { Zone } from "../../entities/zone/types";
import { RENDER_LAYERS } from "../../core/rendering/types";
import type { RootState } from "../../store/store";
import type {
  ActorDragState,
  ShapeDraftState
} from "./canvasInteractionTypes";
import { ActorLayer } from "./ActorLayer";
import { CanvasBackgroundLayer } from "./CanvasBackgroundLayer";
import { CanvasOverlays } from "./CanvasOverlays";
import {
  CANVAS_BACKGROUND_COLOR,
  CANVAS_HEIGHT,
  CANVAS_WIDTH
} from "./canvasConstants";
import type { LocalBoxSelectionState } from "./zoneGeometry";
import { ZoneLayer } from "./ZoneLayer";

type CanvasWorkspaceProps = {
  activeToolId: RootState["interaction"]["activeToolId"];
  actorDrag: ActorDragState | null;
  actorTargetZoneId: string | null;
  backgroundImage: RootState["encounter"]["present"]["backgroundImage"];
  backgroundLuminanceByZoneId: Record<string, number>;
  boxSelection: LocalBoxSelectionState | null;
  canvasBackgroundLuminance: number;
  canvasRef: { current: SVGSVGElement | null };
  encounter: RootState["encounter"]["present"];
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  handleActorMouseDown: (
    actorId: string,
    point: LayoutPoint,
    event: MouseEvent<SVGGElement>
  ) => void;
  handleCanvasClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasContextMenu: MouseEventHandler<SVGSVGElement>;
  handleCanvasDoubleClick: MouseEventHandler<SVGSVGElement>;
  handleCanvasDragOver: DragEventHandler<SVGSVGElement>;
  handleCanvasDrop: DragEventHandler<SVGSVGElement>;
  handleCanvasMouseDown: MouseEventHandler<SVGSVGElement>;
  handleCanvasMouseMove: MouseEventHandler<SVGSVGElement>;
  handleCanvasMouseUp: MouseEventHandler<SVGSVGElement>;
  handleResizeHandleMouseDown: (
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement>
  ) => void;
  polygonDraftColor: string;
  selection: RootState["interaction"]["selection"];
  shapeDraft: ShapeDraftState | null;
  showFactionOutlines: boolean;
  onActorMouseEnter: (actorId: string) => void;
  onActorMouseLeave: (actorId: string) => void;
  zoneDraftPoints: LayoutPoint[];
  zoneShapeMode: RootState["interaction"]["zoneShapeMode"];
};

export function CanvasWorkspace({
  activeToolId,
  actorDrag,
  actorTargetZoneId,
  backgroundImage,
  backgroundLuminanceByZoneId,
  boxSelection,
  canvasBackgroundLuminance,
  canvasRef,
  encounter,
  getDisplayedPolygon,
  handleActorMouseDown,
  handleCanvasClick,
  handleCanvasContextMenu,
  handleCanvasDoubleClick,
  handleCanvasDragOver,
  handleCanvasDrop,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleResizeHandleMouseDown,
  onActorMouseEnter,
  onActorMouseLeave,
  polygonDraftColor,
  selection,
  shapeDraft,
  showFactionOutlines,
  zoneDraftPoints,
  zoneShapeMode
}: CanvasWorkspaceProps) {
  return (
    <svg
      aria-label="SVG encounter workspace"
      className={`h-full min-h-0 w-full bg-[${CANVAS_BACKGROUND_COLOR}]`}
      ref={(svg) => {
        canvasRef.current = svg;
      }}
      onClick={handleCanvasClick}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleCanvasDragOver}
      onDrop={handleCanvasDrop}
      onDoubleClick={handleCanvasDoubleClick}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      role="img"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
    >
      {RENDER_LAYERS.map((layer) => (
        <g
          key={layer.id}
          aria-label={`${layer.label} layer`}
          data-layer={layer.id}
        >
          {layer.id === "background" ? (
            <CanvasBackgroundLayer backgroundImage={backgroundImage} />
          ) : null}
          {layer.id === "zones" ? (
            <ZoneLayer
              activeToolId={activeToolId}
              actorTargetZoneId={actorTargetZoneId}
              backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
              getDisplayedPolygon={getDisplayedPolygon}
              onResizeHandleMouseDown={handleResizeHandleMouseDown}
              selection={selection}
              zones={encounter.zones}
            />
          ) : null}
          {layer.id === "actors" ? (
            <ActorLayer
              actorDrag={actorDrag}
              backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
              canvasBackgroundLuminance={canvasBackgroundLuminance}
              encounter={encounter}
              onActorMouseDown={handleActorMouseDown}
              onActorMouseEnter={onActorMouseEnter}
              onActorMouseLeave={onActorMouseLeave}
              selection={selection}
              showFactionOutlines={showFactionOutlines}
            />
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
    </svg>
  );
}
