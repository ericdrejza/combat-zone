import type { DragEvent, MouseEvent } from 'react';

import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import type { ZoneShape } from '@entities/zone/types';
import type { RootState } from '@store/store';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CIRCLE_SEGMENTS,
  HEXAGON_SEGMENTS
} from '../canvasConstants';
import { clientPointToViewBoxPoint } from '../canvasCoordinates';

export type Bounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type LocalBoxSelectionState = {
  current: LayoutPoint;
  start: LayoutPoint;
};

type ZoneDragPreviewState = {
  current: LayoutPoint;
  originalPolygon: LayoutPoint[];
  phase: 'dragging' | 'committed';
  start: LayoutPoint;
  zoneId: string;
};

type VertexDragPreviewState = {
  polygon: LayoutPoint[];
  zoneId: string;
};

export function distance(first: LayoutPoint, second: LayoutPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function toSvgPoint(
  event: Pick<globalThis.MouseEvent, 'clientX' | 'clientY'>,
  svg: SVGSVGElement
): LayoutPoint {
  return clientPointToViewBoxPoint(
    { x: event.clientX, y: event.clientY },
    svg.getBoundingClientRect(),
    { height: CANVAS_HEIGHT, width: CANVAS_WIDTH }
  );
}

export function polygonToPoints(polygon: LayoutPoint[]): string {
  return polygon.map((point) => `${point.x},${point.y}`).join(' ');
}

export function getDisplayedZonePolygon(
  zone: Zone,
  zoneDrag?: ZoneDragPreviewState | null,
  vertexDrag?: VertexDragPreviewState | null
): LayoutPoint[] {
  if (zoneDrag?.zoneId === zone.id && zoneDrag.phase === 'dragging') {
    const offset = {
      x: zoneDrag.current.x - zoneDrag.start.x,
      y: zoneDrag.current.y - zoneDrag.start.y
    };

    return zoneDrag.originalPolygon.map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y
    }));
  }

  return vertexDrag?.zoneId === zone.id ? vertexDrag.polygon : zone.polygon;
}

export function createRectanglePolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return [
    start,
    { x: current.x, y: start.y },
    current,
    { x: start.x, y: current.y }
  ];
}

export function createSegmentedEllipsePolygon(
  start: LayoutPoint,
  current: LayoutPoint,
  segments: number
): LayoutPoint[] {
  const center = {
    x: (start.x + current.x) / 2,
    y: (start.y + current.y) / 2
  };
  const radiusX = Math.abs(current.x - start.x) / 2;
  const radiusY = Math.abs(current.y - start.y) / 2;
  const angles = Array.from(
    { length: segments },
    (_, index) => (index / segments) * Math.PI * 2
  );
  const maxCos = Math.max(...angles.map((angle) => Math.abs(Math.cos(angle))));
  const maxSin = Math.max(...angles.map((angle) => Math.abs(Math.sin(angle))));

  return angles.map((angle) => ({
    x: center.x + Math.cos(angle) * (radiusX / maxCos),
    y: center.y + Math.sin(angle) * (radiusY / maxSin)
  }));
}

export function createCirclePolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return createSegmentedEllipsePolygon(start, current, CIRCLE_SEGMENTS);
}

export function createHexagonPolygon(
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  return createSegmentedEllipsePolygon(start, current, HEXAGON_SEGMENTS);
}

export function createShapePolygon(
  shape: Extract<ZoneShape, 'rectangle' | 'circle' | 'hexagon'>,
  start: LayoutPoint,
  current: LayoutPoint
): LayoutPoint[] {
  if (shape === 'rectangle') {
    return createRectanglePolygon(start, current);
  }

  return shape === 'circle'
    ? createCirclePolygon(start, current)
    : createHexagonPolygon(start, current);
}

export function createCirclePolygonFromBounds(bounds: Bounds): LayoutPoint[] {
  return createCirclePolygon(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  );
}

export function createHexagonPolygonFromBounds(bounds: Bounds): LayoutPoint[] {
  return createHexagonPolygon(
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
  );
}

export function getPolygonBounds(polygon: LayoutPoint[]): Bounds {
  const xValues = polygon.map((point) => point.x);
  const yValues = polygon.map((point) => point.y);
  const x = Math.min(...xValues);
  const y = Math.min(...yValues);
  const maxX = Math.max(...xValues);
  const maxY = Math.max(...yValues);

  return {
    height: Math.max(maxY - y, 1),
    width: Math.max(maxX - x, 1),
    x,
    y
  };
}

export function getBoxSelectionBounds(
  boxSelection: LocalBoxSelectionState
): Bounds {
  return getPolygonBounds([
    boxSelection.start,
    { x: boxSelection.current.x, y: boxSelection.start.y },
    boxSelection.current,
    { x: boxSelection.start.x, y: boxSelection.current.y }
  ]);
}

export function sortZoneIdsByPosition(
  zones: RootState['encounter']['present']['zones']
): string[] {
  return [...zones.allIds].sort((firstId, secondId) => {
    const firstZone = zones.byId[firstId];
    const secondZone = zones.byId[secondId];

    if (!firstZone || !secondZone) {
      return firstId.localeCompare(secondId);
    }

    const firstBounds = getPolygonBounds(firstZone.polygon);
    const secondBounds = getPolygonBounds(secondZone.polygon);
    const horizontalDifference = firstBounds.x - secondBounds.x;

    if (horizontalDifference !== 0) {
      return horizontalDifference;
    }

    return firstBounds.y - secondBounds.y;
  });
}

export function getZoneNamePosition(zone: Zone, polygon: LayoutPoint[]) {
  const bounds = getPolygonBounds(polygon);
  const inset = 10;

  if (zone.namePosition === 'top-right') {
    return {
      anchor: 'end' as const,
      dominantBaseline: 'hanging' as const,
      x: bounds.x + bounds.width - inset,
      y: bounds.y + inset
    };
  }

  if (zone.namePosition === 'bottom-right') {
    return {
      anchor: 'end' as const,
      dominantBaseline: 'auto' as const,
      x: bounds.x + bounds.width - inset,
      y: bounds.y + bounds.height - inset
    };
  }

  if (zone.namePosition === 'bottom-left') {
    return {
      anchor: 'start' as const,
      dominantBaseline: 'auto' as const,
      x: bounds.x + inset,
      y: bounds.y + bounds.height - inset
    };
  }

  return {
    anchor: 'start' as const,
    dominantBaseline: 'hanging' as const,
    x: bounds.x + inset,
    y: bounds.y + inset
  };
}
