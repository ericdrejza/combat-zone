import type { LayoutPoint } from './types';
import type { NestingActor, PolygonNestingStrategy } from './nesting_ts';
import { getPolygonBounds, getPolygonCenter } from './polygonGeometry';
import { getCollisionActorGap } from './nestingSpacing';

export function getFlexTargetPoint(
  index: number,
  count: number,
  polygon: LayoutPoint[],
  actors: NestingActor[],
  borderSpacing: number,
  actorGap: number,
  spreadAcrossArea = true
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
  if (!spreadAcrossArea) {
    const limitingRadius = Math.min(maximumXRadius, maximumYRadius);
    const chordFactor = 2 * Math.sin(Math.PI / count);
    const balancedLimitingRadius = Math.min(
      limitingRadius,
      (limitingRadius + requiredActorSpacing) / (1 + chordFactor)
    );
    const radialScale =
      limitingRadius > 0 ? balancedLimitingRadius / limitingRadius : 0;
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;

    return {
      x: center.x + Math.cos(angle) * maximumXRadius * radialScale,
      y: center.y + Math.sin(angle) * maximumYRadius * radialScale
    };
  }

  const hasCenter = count % 2 === 1;

  if (hasCenter && index === 0) {
    return center;
  }

  const pairedIndex = index - (hasCenter ? 1 : 0);
  const pairIndex = Math.floor(pairedIndex / 2);
  const pairCount = Math.floor(count / 2);
  const opposite = pairedIndex % 2 === 1;
  // Sampling the middle of each radial band leaves half a band's worth of
  // room around the outside, mirroring space-around on both polygon axes.
  const radialScale = Math.sqrt(
    (pairIndex + 0.5) / Math.max(1, pairCount)
  );
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle =
    -Math.PI / 2 + pairIndex * goldenAngle + (opposite ? Math.PI : 0);
  const minimumScaleX =
    maximumXRadius > 0 ? requiredActorSpacing / maximumXRadius : 0;
  const minimumScaleY =
    maximumYRadius > 0 ? requiredActorSpacing / maximumYRadius : 0;
  const balancedScale = Math.min(
    1,
    Math.max(radialScale, Math.min(minimumScaleX, minimumScaleY))
  );
  const ringRadiusX = maximumXRadius * balancedScale;
  const ringRadiusY = maximumYRadius * balancedScale;

  return {
    x: center.x + Math.cos(angle) * ringRadiusX,
    y: center.y + Math.sin(angle) * ringRadiusY
  };
}

/** Precomputes every actor target once for a packing pass. */
export function getTargetPoints(
  actors: NestingActor[],
  polygon: LayoutPoint[],
  borderSpacing: number,
  layoutStrategy: PolygonNestingStrategy,
  actorGap: number
): LayoutPoint[] {
  const bounds = getPolygonBounds(polygon);

  if (
    layoutStrategy === 'FLEX' &&
    actors.length >= 3 &&
    isAxisAlignedRectangle(polygon)
  ) {
    const rectangleTargets = getFlexRectangleTargets(
      actors,
      bounds,
      borderSpacing,
      actorGap
    );

    if (rectangleTargets) {
      return rectangleTargets;
    }

    // Large uniform-radius grids can reject an undersized resize immediately.
    // Heterogeneous actors must continue to free-space search because smaller
    // footprints can occupy space beside a large actor.
    if (
      actors.length >= 20 &&
      new Set(actors.map((actor) => actor.radius)).size === 1
    ) {
      return [];
    }
  }

  if (layoutStrategy === 'SEQUENTIAL' && isAxisAlignedRectangle(polygon)) {
    return getSequentialRectangleTargets(
      actors,
      bounds,
      borderSpacing,
      actorGap
    );
  }

  return actors.map((_, index) =>
    getTargetPoint(
      index,
      actors.length,
      polygon,
      actors,
      borderSpacing,
      layoutStrategy,
      actorGap
    )
  );
}

function getFlexRectangleTargets(
  actors: NestingActor[],
  bounds: ReturnType<typeof getPolygonBounds>,
  borderSpacing: number,
  actorGap: number
): LayoutPoint[] | undefined {
  if (actors.length === 0) {
    return [];
  }

  const largestRadius = Math.max(...actors.map((actor) => actor.radius));
  const padding = largestRadius + borderSpacing;
  const usableWidth = bounds.maxX - bounds.minX - padding * 2;
  const usableHeight = bounds.maxY - bounds.minY - padding * 2;
  const minimumCellSize =
    largestRadius * 2 +
    getCollisionActorGap('FLEX', actorGap, actors.length);

  if (usableWidth < 0 || usableHeight < 0) {
    return undefined;
  }

  let best: { columns: number; rows: number; score: number } | undefined;
  const targetRatio = usableWidth / Math.max(1, usableHeight);

  for (let columns = 1; columns <= actors.length; columns += 1) {
    const rows = Math.ceil(actors.length / columns);
    const horizontalSpan = Math.max(0, columns - 1) * minimumCellSize;
    const verticalSpan = Math.max(0, rows - 1) * minimumCellSize;

    if (usableWidth < horizontalSpan || usableHeight < verticalSpan) {
      continue;
    }

    const score =
      Math.abs(columns / rows - targetRatio) +
      (columns * rows - actors.length) / actors.length;

    if (!best || score < best.score) {
      best = { columns, rows, score };
    }
  }

  if (!best) {
    return undefined;
  }

  const rowCounts = Array.from({ length: best.rows }, (_, row) =>
    Math.min(best.columns, actors.length - row * best.columns)
  );
  const verticalGap =
    (usableHeight - Math.max(0, best.rows - 1) * minimumCellSize) /
    (best.rows + 1);
  const targets: LayoutPoint[] = [];

  for (let row = 0; row < best.rows; row += 1) {
    const rowCount = rowCounts[row];
    const rowHorizontalGap =
      (usableWidth - Math.max(0, rowCount - 1) * minimumCellSize) /
      (rowCount + 1);
    const y =
      best.rows === 1
        ? bounds.minY + padding + usableHeight / 2
        : bounds.minY +
          padding +
          verticalGap +
          row * (minimumCellSize + verticalGap);

    for (let column = 0; column < rowCount; column += 1) {
      targets.push({
        x:
          rowCount === 1
            ? bounds.minX + padding + usableWidth / 2
            : bounds.minX +
              padding +
              rowHorizontalGap +
              column * (minimumCellSize + rowHorizontalGap),
        y
      });
    }
  }

  return targets;
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
            2 * Math.asin(Math.min(1, actorSpacing / (2 * outerRadius))),
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
      rows.push({
        actors: [actor],
        width: actorWidth,
        maxRadius: actor.radius
      });
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
    bounds.minY + borderSpacing + Math.max(0, (usableHeight - totalHeight) / 2);
  const targets: LayoutPoint[] = [];

  for (const row of rows) {
    let actorLeft =
      bounds.minX + borderSpacing + Math.max(0, (usableWidth - row.width) / 2);
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
