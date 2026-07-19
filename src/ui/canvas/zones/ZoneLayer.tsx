import type { MouseEvent } from "react";
import { motion } from "motion/react";

import type { LayoutPoint } from "@core/layout/types";
import { isZonePolygonSizeValid } from "@core/validation/zoneSize";
import type { Zone } from "@entities/zone/types";
import type { RootState } from "@store/store";
import type {
  ActorDragEndEvent,
  ZoneDragState
} from "../canvasInteractionTypes";
import {
  CANVAS_SPRING_TRANSITION,
  DIRECT_MANIPULATION_TRANSITION
} from "../canvasMotion";
import { getZoneNameTextColor } from "../canvasLuminance";
import {
  getZoneNamePosition,
  getZoneResizeHandles,
  polygonToPoints
} from "./zoneGeometry";
import { useMotionPreference } from "../../motion_preferences/MotionPreferenceProvider";

type ZoneLayerProps = {
  activeToolId: string;
  actorTargetZoneId: string | null;
  backgroundLuminanceByZoneId: Record<string, number>;
  directManipulationZoneId: string | null;
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  onResizeHandleMouseDown: (
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
  selection: RootState["interaction"]["selection"];
  zoneDrag: ZoneDragState | null;
  zones: RootState["encounter"]["present"]["zones"];
};

export function ZoneLayer({
  activeToolId,
  actorTargetZoneId,
  backgroundLuminanceByZoneId,
  directManipulationZoneId,
  getDisplayedPolygon,
  onResizeHandleDrag,
  onResizeHandleDragEnd,
  onResizeHandleMouseDown,
  onZoneDrag,
  onZoneDragEnd,
  onZoneMotionComplete,
  selection,
  zoneDrag,
  zones
}: ZoneLayerProps) {
  const { animationsDisabled } = useMotionPreference();

  return zones.allIds.map((zoneId) => {
    const zone = zones.byId[zoneId];

    if (!zone) {
      return null;
    }

    const activelyDragged =
      zoneDrag?.zoneId === zone.id && zoneDrag.phase === "dragging";
    const polygon = activelyDragged
      ? zoneDrag.originalPolygon
      : getDisplayedPolygon(zone);
    const selected =
      selection.selectedEntityType === "zone" &&
      selection.selectedIds.includes(zone.id);
    const zoneGeometryTransition =
      directManipulationZoneId === zone.id ||
      animationsDisabled
        ? DIRECT_MANIPULATION_TRANSITION
        : CANVAS_SPRING_TRANSITION;
    const actorTargeted = actorTargetZoneId === zone.id;
    const resizeHandles = getZoneResizeHandles(zone, polygon);
    const namePosition = getZoneNamePosition(zone, polygon);
    const zoneNameTextColor = getZoneNameTextColor(
      zone,
      backgroundLuminanceByZoneId[zone.id]
    );
    const polygonPoints = polygonToPoints(polygon);
    const invalidResizePreview =
      directManipulationZoneId === zone.id &&
      !isZonePolygonSizeValid(polygon);

    return (
      <motion.g
        key={zone.id}
        animate={activelyDragged ? undefined : { x: 0, y: 0 }}
        className="select-none"
        drag={activeToolId === "zone"}
        dragElastic={0}
        dragMomentum={false}
        initial={false}
        onAnimationComplete={() => {
          if (
            zoneDrag?.zoneId === zone.id &&
            zoneDrag.phase === "committed"
          ) {
            onZoneMotionComplete();
          }
        }}
        onDrag={(_, info) => onZoneDrag(info.offset)}
        onDragEnd={(event) => onZoneDragEnd(event)}
        transition={zoneGeometryTransition}
      >
        <motion.polygon
          aria-label={zone.name}
          animate={{
            fill: invalidResizePreview ? "#fecaca" : zone.colorFill,
            fillOpacity: zone.opacity,
            points: polygonPoints,
            strokeWidth: zone.showBorder ? 2 : 0
          }}
          className="cursor-pointer"
          data-entity-id={zone.id}
          data-entity-type="zone"
          initial={false}
          stroke={zone.showBorder ? zone.colorBorder : "transparent"}
          transition={zoneGeometryTransition}
        />
        {selected ? (
          <motion.polygon
            animate={{
              points: polygonPoints,
              strokeDasharray: "8 8",
              strokeWidth: 2
            }}
            className="pointer-events-none fill-none stroke-canvas-ink stroke-2"
            initial={false}
            transition={zoneGeometryTransition}
          />
        ) : null}
        {actorTargeted ? (
          <motion.polygon
            animate={{
              points: polygonPoints,
              strokeDasharray: "20 15",
              strokeOpacity: [0.1, 1, 0.25],
              strokeWidth: 2
            }}
            className="pointer-events-none fill-none stroke-white stroke-2"
            initial={false}
            strokeOpacity={0.1}
            transition={{
              points: zoneGeometryTransition,
              strokeOpacity: {
                duration: 1.2,
                ease: "linear",
                repeat: Infinity
              }
            }}
          />
        ) : null}
        {zone.showName ? (
          <motion.text
            animate={{
              fill: zoneNameTextColor,
              x: namePosition.x,
              y: namePosition.y
            }}
            className="pointer-events-none text-xs font-bold"
            dominantBaseline={namePosition.dominantBaseline}
            initial={false}
            textAnchor={namePosition.anchor}
            transition={zoneGeometryTransition}
          >
            {zone.name}
          </motion.text>
        ) : null}
        {selected && activeToolId === "zone"
          ? resizeHandles.map((point, vertexIndex) => (
              <g key={`${zone.id}-${vertexIndex}`}>
                <motion.circle
                  animate={{
                    cx: point.x,
                    cy: point.y,
                    r: 6,
                    strokeWidth: 2
                  }}
                  className="pointer-events-none fill-canvas-ink stroke-white stroke-2"
                  initial={false}
                  transition={zoneGeometryTransition}
                />
                <motion.circle
                  key={`${zone.id}-${vertexIndex}`}
                  aria-label={`${zone.name} vertex ${vertexIndex + 1}`}
                  animate={{
                    cx: point.x,
                    cy: point.y,
                    r: 10
                  }}
                  className="cursor-move fill-transparent stroke-transparent"
                  drag
                  dragElastic={0}
                  dragMomentum={false}
                  dragSnapToOrigin
                  initial={false}
                  onMouseDown={(event) =>
                    onResizeHandleMouseDown(
                      zone,
                      polygon,
                      point,
                      vertexIndex,
                      event
                    )
                  }
                  onDrag={(_, info) => onResizeHandleDrag(info.offset)}
                  onDragEnd={(event) => onResizeHandleDragEnd(event)}
                  transition={zoneGeometryTransition}
                />
              </g>
            ))
          : null}
      </motion.g>
    );
  });
}
