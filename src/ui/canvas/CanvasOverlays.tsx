import type { LayoutPoint } from "../../core/layout/types";
import type { ZoneShape } from "../../entities/zone/types";
import type { ShapeDraftState } from "./canvasInteractionTypes";
import {
  createShapePolygon,
  getBoxSelectionBounds,
  type LocalBoxSelectionState,
  polygonToPoints
} from "./zoneGeometry";

type CanvasOverlaysProps = {
  boxSelection: LocalBoxSelectionState | null;
  polygonDraftColor: string;
  shapeDraft: ShapeDraftState | null;
  zoneDraftPoints: LayoutPoint[];
  zoneShapeMode: ZoneShape;
};

export function CanvasOverlays({
  boxSelection,
  polygonDraftColor,
  shapeDraft,
  zoneDraftPoints,
  zoneShapeMode
}: CanvasOverlaysProps) {
  return [
    zoneDraftPoints.length > 0 ? (
      <g key="zone-draft" aria-label="Zone draft">
        <polyline
          className="fill-none stroke-2"
          points={polygonToPoints(zoneDraftPoints)}
          stroke={polygonDraftColor}
          strokeDasharray="8 8"
        />
        {zoneDraftPoints.map((point, index) => (
          <circle
            key={`${point.x}-${point.y}-${index}`}
            cx={point.x}
            cy={point.y}
            fill={polygonDraftColor}
            r={index === 0 ? 6 : 4}
          />
        ))}
      </g>
    ) : null,
    shapeDraft ? (
      <polygon
        key="zone-shape-draft"
        aria-label={`${zoneShapeMode} zone draft`}
        className="fill-green-200/40 stroke-canvas-ink stroke-2"
        points={polygonToPoints(
          createShapePolygon(
            shapeDraft.shape,
            shapeDraft.start,
            shapeDraft.current
          )
        )}
        strokeDasharray="8 8"
      />
    ) : null,
    boxSelection ? (
      <rect
        key="zone-box-selection"
        aria-label="Zone box selection"
        className="fill-blue-200/20 stroke-canvas-ink stroke-2"
        height={getBoxSelectionBounds(boxSelection).height}
        strokeDasharray="6 6"
        width={getBoxSelectionBounds(boxSelection).width}
        x={getBoxSelectionBounds(boxSelection).x}
        y={getBoxSelectionBounds(boxSelection).y}
      />
    ) : null
  ];
}
