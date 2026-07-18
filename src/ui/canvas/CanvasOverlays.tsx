import { motion } from "motion/react";

import type { LayoutPoint } from "@core/layout/types";
import type { ZoneShape } from "@entities/zone/types";
import type { ShapeDraftState } from "./canvasInteractionTypes";
import {
  createShapePolygon,
  getBoxSelectionBounds,
  type LocalBoxSelectionState,
  polygonToPoints
} from "./zoneGeometry";
import { DIRECT_MANIPULATION_TRANSITION } from "./canvasMotion";

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
  const shapeDraftPoints = shapeDraft
    ? polygonToPoints(
        createShapePolygon(
          shapeDraft.shape,
          shapeDraft.start,
          shapeDraft.current
        )
      )
    : null;
  const boxSelectionBounds = boxSelection
    ? getBoxSelectionBounds(boxSelection)
    : null;

  return [
    zoneDraftPoints.length > 0 ? (
      <g key="zone-draft" aria-label="Zone draft">
        <motion.polyline
          animate={{
            points: polygonToPoints(zoneDraftPoints),
            stroke: polygonDraftColor,
            strokeDasharray: "8 8",
            strokeWidth: 2
          }}
          className="fill-none stroke-2"
          initial={false}
          transition={DIRECT_MANIPULATION_TRANSITION}
        />
        {zoneDraftPoints.map((point, index) => (
          <motion.circle
            key={`${point.x}-${point.y}-${index}`}
            animate={{
              cx: point.x,
              cy: point.y,
              fill: polygonDraftColor,
              r: index === 0 ? 6 : 4
            }}
            initial={false}
            transition={DIRECT_MANIPULATION_TRANSITION}
          />
        ))}
      </g>
    ) : null,
    shapeDraftPoints ? (
      <motion.polygon
        key="zone-shape-draft"
        aria-label={`${zoneShapeMode} zone draft`}
        animate={{
          points: shapeDraftPoints,
          strokeDasharray: "8 8",
          strokeWidth: 2
        }}
        className="fill-green-200/40 stroke-canvas-ink stroke-2"
        initial={false}
        transition={DIRECT_MANIPULATION_TRANSITION}
      />
    ) : null,
    boxSelectionBounds ? (
      <motion.rect
        key="zone-box-selection"
        aria-label="Zone box selection"
        animate={{
          height: boxSelectionBounds.height,
          strokeDasharray: "6 6",
          strokeWidth: 2,
          width: boxSelectionBounds.width,
          x: boxSelectionBounds.x,
          y: boxSelectionBounds.y
        }}
        className="fill-blue-200/20 stroke-canvas-ink stroke-2"
        initial={false}
        transition={DIRECT_MANIPULATION_TRANSITION}
      />
    ) : null
  ];
}
