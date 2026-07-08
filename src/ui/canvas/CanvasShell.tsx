import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import type { LayoutPoint } from "../../core/layout/types";
import { RENDER_LAYERS } from "../../core/rendering/types";
import type { RootState } from "../../store/store";
import { closeZoneShapeMenu } from "../toolbar/events";
import { CanvasBackgroundLayer } from "./CanvasBackgroundLayer";
import { CanvasOverlays } from "./CanvasOverlays";
import { CanvasToolStatusBadge } from "./CanvasToolStatusBadge";
import { CANVAS_BACKGROUND_COLOR, CANVAS_HEIGHT, CANVAS_WIDTH } from "./canvasConstants";
import { getTextColorForLuminance } from "./canvasLuminance";
import type {
  ShapeDraftState,
  VertexDragState,
  ZoneDragState
} from "./canvasInteractionTypes";
import { ZoneLayer } from "./ZoneLayer";
import { type LocalBoxSelectionState } from "./zoneGeometry";
import { useCanvasInteractionHandlers } from "./useCanvasInteractionHandlers";
import { useCanvasKeyboard } from "./useCanvasKeyboard";
import {
  useBackgroundLuminanceByZoneId,
  usePolygonDraftBackgroundLuminance
} from "./useCanvasLuminance";
export function CanvasShell() {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const activeToolId = useSelector(
    (state: RootState) => state.interaction.activeToolId
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
  const backgroundImage = encounter.backgroundImage;
  const [zoneDraftPoints, setZoneDraftPoints] = useState<LayoutPoint[]>([]);
  const [shapeDraft, setShapeDraft] = useState<ShapeDraftState | null>(null);
  const [vertexDrag, setVertexDrag] = useState<VertexDragState | null>(null);
  const [zoneDrag, setZoneDrag] = useState<ZoneDragState | null>(null);
  const [boxSelection, setBoxSelection] = useState<LocalBoxSelectionState | null>(
    null
  );
  const suppressNextCanvasClickRef = useRef(false);
  const suppressNextCanvasClickUnconditionallyRef = useRef(false);
  const suppressNextCanvasClickPointRef = useRef<LayoutPoint | null>(null);
  const suppressNextEntityClickRef = useRef<string | null>(null);
  const backgroundLuminanceByZoneId = useBackgroundLuminanceByZoneId(
    backgroundImage,
    encounter.zones
  );
  const polygonDraftBackgroundLuminance = usePolygonDraftBackgroundLuminance(
    backgroundImage,
    zoneDraftPoints
  );

  useCanvasKeyboard({
    activeToolId,
    clearShapeDraft: () => setShapeDraft(null),
    clearZoneDraftPoints: () => setZoneDraftPoints([]),
    closeZoneShapeMenu,
    dispatch,
    encounter,
    selection,
    zonePaintBrush
  });

  const {
    getDisplayedPolygon,
    handleCanvasClick,
    handleCanvasContextMenu,
    handleCanvasDoubleClick,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleResizeHandleMouseDown
  } = useCanvasInteractionHandlers({
    activeToolId,
    boxSelection,
    dispatch,
    encounter,
    lastZoneOpacity,
    selection,
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

  const polygonDraftColor = getTextColorForLuminance(
    polygonDraftBackgroundLuminance
  );

  return (
    <section
      aria-label="Encounter canvas"
      className="relative min-h-0 overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-sm"
      role="main"
    >
      <svg
        aria-label="SVG encounter workspace"
        className={`h-full min-h-0 w-full bg-[${CANVAS_BACKGROUND_COLOR}]`}
        onClick={handleCanvasClick}
        onContextMenu={handleCanvasContextMenu}
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
            {layer.id === "zones"
              ? (
                  <ZoneLayer
                    activeToolId={activeToolId}
                    backgroundLuminanceByZoneId={backgroundLuminanceByZoneId}
                    getDisplayedPolygon={getDisplayedPolygon}
                    onResizeHandleMouseDown={handleResizeHandleMouseDown}
                    selection={selection}
                    zones={encounter.zones}
                  />
                )
              : null}
            {layer.id === "uiOverlays"
              ? (
                  <CanvasOverlays
                    boxSelection={boxSelection}
                    polygonDraftColor={polygonDraftColor}
                    shapeDraft={shapeDraft}
                    zoneDraftPoints={zoneDraftPoints}
                    zoneShapeMode={zoneShapeMode}
                  />
                )
              : null}
          </g>
        ))}
      </svg>
      <CanvasToolStatusBadge
        activeToolId={activeToolId}
        zoneShapeMode={zoneShapeMode}
      />
    </section>
  );
}
