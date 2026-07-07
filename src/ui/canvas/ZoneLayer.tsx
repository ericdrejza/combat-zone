import type { MouseEvent } from "react";

import type { LayoutPoint } from "../../core/layout/types";
import type { Zone } from "../../entities/zone/types";
import type { RootState } from "../../store/store";
import {
  CANVAS_BACKGROUND_COLOR,
  LOW_ZONE_OPACITY_THRESHOLD
} from "./canvasConstants";
import {
  getHexLuminance,
  getReadableTextColor,
  getTextColorForLuminance
} from "./canvasLuminance";
import {
  getZoneNamePosition,
  getZoneResizeHandles,
  polygonToPoints
} from "./zoneGeometry";

type ZoneLayerProps = {
  activeToolId: string;
  backgroundLuminanceByZoneId: Record<string, number>;
  getDisplayedPolygon: (zone: Zone) => LayoutPoint[];
  onResizeHandleMouseDown: (
    zone: Zone,
    polygon: LayoutPoint[],
    point: LayoutPoint,
    vertexIndex: number,
    event: MouseEvent<SVGCircleElement>
  ) => void;
  selection: RootState["interaction"]["selection"];
  zones: RootState["encounter"]["present"]["zones"];
};

export function ZoneLayer({
  activeToolId,
  backgroundLuminanceByZoneId,
  getDisplayedPolygon,
  onResizeHandleMouseDown,
  selection,
  zones
}: ZoneLayerProps) {
  return zones.allIds.map((zoneId) => {
    const zone = zones.byId[zoneId];

    if (!zone) {
      return null;
    }

    const polygon = getDisplayedPolygon(zone);
    const selected =
      selection.selectedEntityType === "zone" &&
      selection.selectedIds.includes(zone.id);
    const resizeHandles = getZoneResizeHandles(zone, polygon);
    const namePosition = getZoneNamePosition(zone, polygon);
    const zoneNameTextColor =
      zone.shape === "circle" ||
      zone.shape === "hexagon" ||
      zone.opacity < LOW_ZONE_OPACITY_THRESHOLD
        ? getTextColorForLuminance(
            backgroundLuminanceByZoneId[zone.id] ??
              getHexLuminance(CANVAS_BACKGROUND_COLOR)
          )
        : getReadableTextColor(zone.colorFill);

    return (
      <g key={zone.id}>
        <polygon
          aria-label={zone.name}
          className="cursor-pointer"
          data-entity-id={zone.id}
          data-entity-type="zone"
          fill={zone.colorFill}
          fillOpacity={zone.opacity}
          points={polygonToPoints(polygon)}
          stroke={zone.showBorder ? zone.colorBorder : "transparent"}
          strokeWidth={zone.showBorder ? 2 : 0}
        />
        {selected ? (
          <polygon
            className="pointer-events-none fill-none stroke-canvas-ink stroke-2"
            points={polygonToPoints(polygon)}
            strokeDasharray="8 8"
          />
        ) : null}
        {zone.showName ? (
          <text
            className="pointer-events-none text-xs font-bold"
            dominantBaseline={namePosition.dominantBaseline}
            fill={zoneNameTextColor}
            textAnchor={namePosition.anchor}
            x={namePosition.x}
            y={namePosition.y}
          >
            {zone.name}
          </text>
        ) : null}
        {selected && activeToolId === "zone"
          ? resizeHandles.map((point, vertexIndex) => (
              <circle
                key={`${zone.id}-${vertexIndex}`}
                aria-label={`${zone.name} vertex ${vertexIndex + 1}`}
                className="cursor-move fill-canvas-ink stroke-white stroke-2"
                cx={point.x}
                cy={point.y}
                onMouseDown={(event) =>
                  onResizeHandleMouseDown(
                    zone,
                    polygon,
                    point,
                    vertexIndex,
                    event
                  )
                }
                r="6"
              />
            ))
          : null}
      </g>
    );
  });
}
