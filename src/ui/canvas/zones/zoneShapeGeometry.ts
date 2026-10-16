import type { DragEvent, MouseEvent } from 'react';

import type { LayoutPoint } from '@core/layout/types';
import type { Zone } from '@entities/zone/types';
import { getPolygonBounds, type Bounds } from '@entities/zone/zoneShapeGeometry';
import type { RootState } from '@store/store';
import { clientPointToViewBoxPoint } from '../canvasCoordinates';

export * from '@entities/zone/zoneShapeGeometry';

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
  const viewBoxAttribute = svg
    .getAttribute('viewBox')
    ?.split(/\s+/)
    .map(Number);
  const viewBox = svg.viewBox?.baseVal;

  return clientPointToViewBoxPoint(
    { x: event.clientX, y: event.clientY },
    svg.getBoundingClientRect(),
    {
      height: viewBox?.height ?? viewBoxAttribute?.[3] ?? 640,
      width: viewBox?.width ?? viewBoxAttribute?.[2] ?? 960,
      x: viewBox?.x ?? viewBoxAttribute?.[0] ?? 0,
      y: viewBox?.y ?? viewBoxAttribute?.[1] ?? 0
    }
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
