import type { LayoutPoint } from './types';
import type { NestingActor, PolygonNestingStrategy } from './nesting_ts';
import { getPolygonBounds, getPolygonCenter } from './polygonGeometry';

export function getFlexTargetPoint(
  index: number,
  count: number,
  polygon: LayoutPoint[],
  actors: NestingActor[],
  borderSpacing: number,
  actorGap: number
): LayoutPoint {
  const center = getPolygonCenter(polygon);
  const bounds = getPolygonBounds(polygon);
  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  const requiredActorSpacing = largestRadius * 2 + actorGap;

  if (count === 1) {
    return center;
  }

  if (count === 2) {
    const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
    const axisRadius = Math.max(
      0,
      (horizontal ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY) / 2 -
        largestRadius -
        borderSpacing
    );
    const offset = Math.min(
      axisRadius,
      (axisRadius + requiredActorSpacing) / 3
    );

    return horizontal
      ? { x: center.x + (index === 0 ? offset : -offset), y: center.y }
      : { x: center.x, y: center.y + (index === 0 ? offset : -offset) };
  }

  const maximumXRadius = Math.max(
    0,
    (bounds.maxX - bounds.minX) / 2 - largestRadius - borderSpacing
  );
  const maximumYRadius = Math.max(
    0,
    (bounds.maxY - bounds.minY) / 2 - largestRadius - borderSpacing
  );
  const limitingRadius = Math.min(maximumXRadius, maximumYRadius);
  const chordFactor = 2 * Math.sin(Math.PI / count);
  const balancedLimitingRadius = Math.min(
    limitingRadius,
    (limitingRadius + requiredActorSpacing) / (1 + chordFactor)
  );
  const radialScale =
    limitingRadius > 0 ? balancedLimitingRadius / limitingRadius : 0;
  const ringRadiusX = maximumXRadius * radialScale;
  const ringRadiusY = maximumYRadius * radialScale;
  const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;

  return {
    x: center.x + Math.cos(angle) * ringRadiusX,
    y: center.y + Math.sin(angle) * ringRadiusY
  };
}

export function getTargetPoint(
  index: number,
  count: number,
  polygon: LayoutPoint[],
  actors: NestingActor[],
  borderSpacing: number,
  layoutStrategy: PolygonNestingStrategy,
  actorGap: number
): LayoutPoint {
  const bounds = getPolygonBounds(polygon);

  if (layoutStrategy === 'SEQUENTIAL' && isAxisAlignedRectangle(polygon)) {
    return (
      getSequentialRectangleTargets(actors, bounds, borderSpacing, actorGap)[
        index
      ] ?? getPolygonCenter(polygon)
    );
  }

  if (layoutStrategy === 'SEQUENTIAL') {
    const largestRadius = Math.max(...actors.map((actor) => actor.radius));
    const outerRadius = Math.max(
      0,
      Math.min(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 2 -
        largestRadius -
        borderSpacing
    );
    const actorSpacing = largestRadius * 2 + actorGap;
    const angleStep =
      outerRadius <= 0
        ? Math.PI * 2
        : Math.max(
            2 *
              Math.asin(
                Math.min(1, actorSpacing / (2 * outerRadius))
              ),
            Math.PI / 24
          );
    const angle = -Math.PI / 2 + index * angleStep;
    const center = getPolygonCenter(polygon);

    return {
      x: center.x + Math.cos(angle) * outerRadius,
      y: center.y + Math.sin(angle) * outerRadius
    };
  }

  return getFlexTargetPoint(
    index,
    count,
    polygon,
    actors,
    borderSpacing,
    actorGap
  );
}

type SequentialRectangleRow = {
  actors: NestingActor[];
  width: number;
  maxRadius: number;
};

function getSequentialRectangleTargets(
  actors: NestingActor[],
  bounds: ReturnType<typeof getPolygonBounds>,
  borderSpacing: number,
  actorGap: number
): LayoutPoint[] {
  const usableWidth = bounds.maxX - bounds.minX - borderSpacing * 2;
  const rows: SequentialRectangleRow[] = [];

  for (const actor of actors) {
    const actorWidth = actor.radius * 2;
    const currentRow = rows[rows.length - 1];
    const widthWithActor = currentRow
      ? currentRow.width + actorGap + actorWidth
      : actorWidth;

    if (currentRow && widthWithActor > usableWidth) {
      rows.push({ actors: [actor], width: actorWidth, maxRadius: actor.radius });
      continue;
    }

    if (currentRow) {
      currentRow.actors.push(actor);
      currentRow.width = widthWithActor;
      currentRow.maxRadius = Math.max(currentRow.maxRadius, actor.radius);
      continue;
    }

    rows.push({ actors: [actor], width: actorWidth, maxRadius: actor.radius });
  }

  const usableHeight = bounds.maxY - bounds.minY - borderSpacing * 2;
  const totalHeight =
    rows.reduce((height, row) => height + row.maxRadius * 2, 0) +
    Math.max(0, rows.length - 1) * actorGap;
  let rowTop =
    bounds.minY +
    borderSpacing +
    Math.max(0, (usableHeight - totalHeight) / 2);
  const targets: LayoutPoint[] = [];

  for (const row of rows) {
    let actorLeft =
      bounds.minX +
      borderSpacing +
      Math.max(0, (usableWidth - row.width) / 2);
    const rowCenterY = rowTop + row.maxRadius;

    for (const actor of row.actors) {
      targets.push({ x: actorLeft + actor.radius, y: rowCenterY });
      actorLeft += actor.radius * 2 + actorGap;
    }

    rowTop += row.maxRadius * 2 + actorGap;
  }

  return targets;
}

function isAxisAlignedRectangle(polygon: LayoutPoint[]): boolean {
  if (polygon.length !== 4) {
    return false;
  }

  const bounds = getPolygonBounds(polygon);
  const uniqueX = new Set(polygon.map((point) => point.x));
  const uniqueY = new Set(polygon.map((point) => point.y));

  return (
    uniqueX.size === 2 &&
    uniqueY.size === 2 &&
    polygon.every(
      (point) =>
        (point.x === bounds.minX || point.x === bounds.maxX) &&
        (point.y === bounds.minY || point.y === bounds.maxY)
    )
  );
}
