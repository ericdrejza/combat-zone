import { displayedZoneDragPolygon } from './displayedZoneDragPolygon';
import { getZoneLocalPolygon, rotatePoint } from '@entities/zone/zoneRotation';
import { ZoneSelectionOutline } from "./ZoneSelectionOutline";
import { useZoneMotionPoints } from './useZoneMotionPoints';
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { memo, useRef } from "react";
import { motion } from "motion/react";

import { getEngagementAwareSplitInput } from "@core/layout/engagementSplitLayout";
import { getFittingSplitSectionDividers } from "@core/layout/splitSectionDividers";
import type { LayoutPoint } from "@core/layout/types";
import { isZonePolygonSizeValid } from "@core/validation/zoneSize";
import type { Zone } from "@entities/zone/types";
import {
  getCanvasTransition
} from "../canvasMotion";
import { getReadableTextColor, getZoneNameTextColor } from "../canvasLuminance";
import {
  getZoneNamePosition,
  polygonToPoints
} from "./zoneGeometry";
import { useMotionPreference } from "@ui/motion_preferences/MotionPreferenceProvider";

import type { ZoneLayerProps } from "./zoneLayerTypes";

type Props = Pick<ZoneLayerProps, "onZoneMotionComplete"> & {
  zone: Zone;
  encounter?: ZoneLayerProps["encounter"];
  polygon: LayoutPoint[];
  selected: boolean;
  actorTargeted: boolean;
  directManipulation: boolean;
  previewingOpacity: boolean;
  previewingColor?: boolean;
  renderedOpacity: number;
  backgroundLuminance: number | undefined;
  zoneDrag: ZoneLayerProps["zoneDrag"];
};

/** Only the Zone whose presentation changes needs to update its Motion tree. */
export const ZoneVisual = memo(function ZoneVisual({ zone, polygon, selected, actorTargeted,
  directManipulation, previewingOpacity, previewingColor = false, renderedOpacity, backgroundLuminance, zoneDrag,
  encounter, onZoneMotionComplete }: Props) {
  const { zoneBorderThickness } = useInterfacePreferences();
  const { animationsDisabled } = useMotionPreference();
  const activelyDragged =
    zoneDrag?.phase === "dragging";
  const gesture = useRef(0);
  if (activelyDragged && zoneDrag.gestureId !== undefined) gesture.current = zoneDrag.gestureId;
  const displayedPolygon = displayedZoneDragPolygon(polygon, zoneDrag);
  // Settle absolute geometry in one track; separately animating a group offset
  // would temporarily apply the movement twice when validation completes.
  const zoneGeometryTransition = getCanvasTransition(
    directManipulation || previewingOpacity,
    animationsDisabled
  );
  const namePosition = getZoneNamePosition(zone, displayedPolygon);
  const zoneNameTextColor = getZoneNameTextColor(
    zone,
    backgroundLuminance
  );
  const polygonPoints = polygonToPoints(displayedPolygon);
  const motionPoints = useZoneMotionPoints(polygonPoints, directManipulation, zoneGeometryTransition, gesture.current);
  const isSplitLayout =
    zone.layoutStrategy === "SPLIT_FLEX" ||
    zone.layoutStrategy === "SPLIT_SEQUENTIAL";
  const splitInput =
    zone.showSectionDividers && isSplitLayout && encounter
      ? getEngagementAwareSplitInput(encounter, zone.id)
      : undefined;
  const sectionDividers =
    zone.showSectionDividers && isSplitLayout
      ? getFittingSplitSectionDividers({
          actors: splitInput?.actors ?? [],
          layoutOrientation: zone.layoutOrientation,
          layoutStrategy: zone.layoutStrategy,
          polygon: getZoneLocalPolygon({ ...zone, polygon: displayedPolygon }),
          splitSectionOrder: splitInput?.splitSectionOrder
        }).map(divider => ({ ...divider, start: rotatePoint(divider.start, zone.rotation ?? 0), end: rotatePoint(divider.end, zone.rotation ?? 0) }))
      : [];
  const sectionClipId = `zone-section-clip-${zone.id}`;
  const invalidResizePreview =
    directManipulation &&
    !isZonePolygonSizeValid(displayedPolygon);

  return (
    <motion.g
      key={zone.id}
      className="select-none"
      initial={false}
      onAnimationComplete={() => {
        if (
          zoneDrag?.zoneId === zone.id &&
          zoneDrag.phase === "committed"
        ) {
          onZoneMotionComplete();
        }
      }}
      transition={zoneGeometryTransition}
    >
      <g>
      <motion.polygon
        points={motionPoints}
        aria-label={zone.name}
        animate={{
          fill: invalidResizePreview ? "#fecaca" : zone.colorFill,
          fillOpacity: renderedOpacity,
          strokeWidth: zone.showBorder ? zoneBorderThickness : 0
        }}
        className="cursor-pointer"
        data-entity-id={zone.id}
        data-entity-type="zone"
        initial={false}
        stroke={zone.showBorder ? zone.colorBorder : "transparent"}
        transition={previewingColor ? { ...zoneGeometryTransition, fill: { duration: 0 } } : zoneGeometryTransition}
      />
      {sectionDividers.length > 0 ? (
        <>
          <defs>
            <clipPath id={sectionClipId}>
              <motion.polygon
                  points={motionPoints}
                initial={false}
                transition={zoneGeometryTransition}
              />
            </clipPath>
          </defs>
          <g
            aria-label={`${zone.name} section dividers`}
            clipPath={`url(#${sectionClipId})`}
            data-zone-section-dividers={zone.id}
          >
            {sectionDividers.map((divider, index) => (
              <motion.line
                  key={`${zone.id}-section-divider-${index}-${gesture.current}`}
                animate={{
                  x1: divider.start.x,
                  x2: divider.end.x,
                  y1: divider.start.y,
                  y2: divider.end.y
                }}
                className="pointer-events-none"
                data-zone-section-divider={index}
                initial={false}
                stroke={zone.colorBorder}
                strokeDasharray="8 8"
                strokeOpacity={0.7}
                strokeWidth={2}
                transition={zoneGeometryTransition}
              />
            ))}
          </g>
        </>
      ) : null}
      {selected ? (
        <ZoneSelectionOutline color={zone.colorBorder ? getReadableTextColor(zone.colorBorder) : zoneNameTextColor} points={motionPoints} transition={zoneGeometryTransition} />
      ) : null}
      {actorTargeted ? (
        <motion.polygon
          points={motionPoints}
          animate={{
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
          key={gesture.current}
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

      </g>
    </motion.g>
  );
});
