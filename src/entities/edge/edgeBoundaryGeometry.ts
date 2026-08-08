import type { LayoutPoint } from "@core/layout/types";

type BoundaryPair = { end: LayoutPoint; start: LayoutPoint };

export function distance(a: LayoutPoint, b: LayoutPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function center(polygon: LayoutPoint[]): LayoutPoint {
  return polygon.reduce(
    (sum, point) => ({
      x: sum.x + point.x / polygon.length,
      y: sum.y + point.y / polygon.length
    }),
    { x: 0, y: 0 }
  );
}

export function closestBoundaryPoint(
  polygon: LayoutPoint[],
  target: LayoutPoint
): LayoutPoint {
  let closest = polygon[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  polygon.forEach((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
      ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared
    ));
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const candidateDistance = distance(candidate, target);
    if (candidateDistance < closestDistance) {
      closest = candidate;
      closestDistance = candidateDistance;
    }
  });
  return closest;
}

function axisAlignedPair(
  fromStart: LayoutPoint,
  fromEnd: LayoutPoint,
  toStart: LayoutPoint,
  toEnd: LayoutPoint,
  preferred: LayoutPoint
): BoundaryPair | undefined {
  if (fromStart.x === fromEnd.x && toStart.x === toEnd.x) {
    const overlapStart = Math.max(
      Math.min(fromStart.y, fromEnd.y),
      Math.min(toStart.y, toEnd.y)
    );
    const overlapEnd = Math.min(
      Math.max(fromStart.y, fromEnd.y),
      Math.max(toStart.y, toEnd.y)
    );
    if (overlapStart <= overlapEnd) {
      const y = Math.max(overlapStart, Math.min(overlapEnd, preferred.y));
      return {
        end: { x: toStart.x, y },
        start: { x: fromStart.x, y }
      };
    }
  }
  if (fromStart.y === fromEnd.y && toStart.y === toEnd.y) {
    const overlapStart = Math.max(
      Math.min(fromStart.x, fromEnd.x),
      Math.min(toStart.x, toEnd.x)
    );
    const overlapEnd = Math.min(
      Math.max(fromStart.x, fromEnd.x),
      Math.max(toStart.x, toEnd.x)
    );
    if (overlapStart <= overlapEnd) {
      const x = Math.max(overlapStart, Math.min(overlapEnd, preferred.x));
      return {
        end: { x, y: toStart.y },
        start: { x, y: fromStart.y }
      };
    }
  }
  return undefined;
}

/** Finds the globally shortest pair while preferring centered cardinal ties. */
export function closestBoundaryPair(
  fromPolygon: LayoutPoint[],
  toPolygon: LayoutPoint[]
): BoundaryPair {
  const fromCenter = center(fromPolygon);
  const toCenter = center(toPolygon);
  const preferred = {
    x: (fromCenter.x + toCenter.x) / 2,
    y: (fromCenter.y + toCenter.y) / 2
  };
  const candidates: BoundaryPair[] = [{
    end: closestBoundaryPoint(toPolygon, fromCenter),
    start: closestBoundaryPoint(fromPolygon, toCenter)
  }];
  fromPolygon.forEach((fromStart, fromIndex) => {
    const fromEnd = fromPolygon[(fromIndex + 1) % fromPolygon.length];
    toPolygon.forEach((toStart, toIndex) => {
      const toEnd = toPolygon[(toIndex + 1) % toPolygon.length];
      const aligned = axisAlignedPair(
        fromStart,
        fromEnd,
        toStart,
        toEnd,
        preferred
      );
      if (aligned) candidates.push(aligned);
      candidates.push(
        { end: closestBoundaryPoint([toStart, toEnd], fromStart), start: fromStart },
        { end: toStart, start: closestBoundaryPoint([fromStart, fromEnd], toStart) }
      );
    });
  });
  return candidates.reduce((closest, candidate) => {
    const distanceDelta = distance(candidate.start, candidate.end) -
      distance(closest.start, closest.end);
    if (Math.abs(distanceDelta) > 0.01) {
      return distanceDelta < 0 ? candidate : closest;
    }
    const midpointDistance = (pair: BoundaryPair) => distance(preferred, {
      x: (pair.start.x + pair.end.x) / 2,
      y: (pair.start.y + pair.end.y) / 2
    });
    return midpointDistance(candidate) < midpointDistance(closest)
      ? candidate
      : closest;
  });
}

export function segmentDistance(
  point: LayoutPoint,
  start: LayoutPoint,
  end: LayoutPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t });
}

/** Quantizes an endpoint arrow to the dominant direction of its path segment. */
export function getCardinalPathArrowAngle(travel: LayoutPoint): number {
  if (Math.abs(travel.x) >= Math.abs(travel.y)) {
    return travel.x >= 0 ? 0 : 180;
  }
  return travel.y >= 0 ? 90 : -90;
}
