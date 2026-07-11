import type { LayoutPoint } from '../../core/layout/types';
import type { Actor } from '../../entities/actor/types';
import { isPointInPolygon } from './zoneGeometry';

export const FLEX_ZONE_EDGE_GAP = 16;

export type FlexActor = {
  actor: Actor;
  radius: number;
};

type PlacedActor = FlexActor & {
  point: LayoutPoint;
};

function distanceToSegment(
  point: LayoutPoint,
  start: LayoutPoint,
  end: LayoutPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) /
        lengthSquared
    )
  );
  const closest = {
    x: start.x + projection * dx,
    y: start.y + projection * dy
  };

  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function distanceToPolygonEdge(
  point: LayoutPoint,
  polygon: LayoutPoint[]
): number {
  return Math.min(
    ...polygon.map((vertex, index) =>
      distanceToSegment(
        point,
        vertex,
        polygon[(index + 1) % polygon.length]
      )
    )
  );
}

function getPolygonCenter(polygon: LayoutPoint[]): LayoutPoint {
  const sums = polygon.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: sums.x / polygon.length,
    y: sums.y / polygon.length
  };
}

function moveAlong(
  point: LayoutPoint,
  target: LayoutPoint,
  distance: number
): LayoutPoint {
  const length = Math.hypot(target.x - point.x, target.y - point.y);

  if (length === 0) {
    return point;
  }

  return {
    x: point.x + ((target.x - point.x) / length) * distance,
    y: point.y + ((target.y - point.y) / length) * distance
  };
}

function moveFromVertex(
  vertex: LayoutPoint,
  previous: LayoutPoint,
  next: LayoutPoint,
  distance: number
): LayoutPoint {
  const previousLength = Math.hypot(
    previous.x - vertex.x,
    previous.y - vertex.y
  );
  const nextLength = Math.hypot(next.x - vertex.x, next.y - vertex.y);

  return {
    x:
      vertex.x +
      ((previous.x - vertex.x) / previousLength) * distance +
      ((next.x - vertex.x) / nextLength) * distance,
    y:
      vertex.y +
      ((previous.y - vertex.y) / previousLength) * distance +
      ((next.y - vertex.y) / nextLength) * distance
  };
}

function addCandidate(candidates: LayoutPoint[], candidate: LayoutPoint) {
  if (
    !candidates.some(
      (existing) =>
        Math.abs(existing.x - candidate.x) < 0.5 &&
        Math.abs(existing.y - candidate.y) < 0.5
    )
  ) {
    candidates.push(candidate);
  }
}

function getCandidatePoints(
  polygon: LayoutPoint[],
  radius: number,
  center: LayoutPoint
): LayoutPoint[] {
  const candidates: LayoutPoint[] = [];
  const inset = radius + FLEX_ZONE_EDGE_GAP;

  // Vertices are intentionally first. They tend to maximize separation in
  // non-circular zones while still giving the solver a stable tie-breaker.
  polygon.forEach((vertex, index) => {
    const previous = polygon[(index + polygon.length - 1) % polygon.length];
    const next = polygon[(index + 1) % polygon.length];
    addCandidate(
      candidates,
      moveFromVertex(vertex, previous, next, inset)
    );
  });

  polygon.forEach((vertex, index) => {
    const next = polygon[(index + 1) % polygon.length];
    addCandidate(
      candidates,
      moveAlong(
        vertex,
        next,
        Math.hypot(next.x - vertex.x, next.y - vertex.y) / 2
      )
    );
  });
  addCandidate(candidates, center);

  const minX = Math.min(...polygon.map((point) => point.x));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxY = Math.max(...polygon.map((point) => point.y));
  const step = Math.max(24, radius * 0.9);

  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      addCandidate(candidates, { x, y });
    }
  }

  return candidates;
}

function hasRoomFromPlacedActors(
  point: LayoutPoint,
  radius: number,
  placedActors: PlacedActor[]
): boolean {
  return placedActors.every(
    (placed) =>
      Math.hypot(point.x - placed.point.x, point.y - placed.point.y) >=
      radius + placed.radius
  );
}

function chooseCandidate(
  actor: FlexActor,
  polygon: LayoutPoint[],
  center: LayoutPoint,
  placedActors: PlacedActor[]
): LayoutPoint {
  const candidates = getCandidatePoints(polygon, actor.radius, center);
  const preferredClearance = actor.radius + FLEX_ZONE_EDGE_GAP;
  const insideCandidates = candidates.filter((candidate) =>
    isPointInPolygon(candidate, polygon)
  );
  const clearCandidates = insideCandidates.filter(
    (candidate) =>
      distanceToPolygonEdge(candidate, polygon) >= preferredClearance &&
      hasRoomFromPlacedActors(candidate, actor.radius, placedActors)
  );
  const roomCandidates = insideCandidates.filter((candidate) =>
    hasRoomFromPlacedActors(candidate, actor.radius, placedActors)
  );
  const availableCandidates = clearCandidates.length
    ? clearCandidates
    : roomCandidates.length
      ? roomCandidates
      : insideCandidates;

  if (availableCandidates.length === 0) {
    return center;
  }

  return availableCandidates.reduce((best, candidate) => {
    const bestDistance = Math.min(
      ...placedActors.map((placed) =>
        Math.hypot(best.x - placed.point.x, best.y - placed.point.y)
      )
    );
    const candidateDistance = Math.min(
      ...placedActors.map((placed) =>
        Math.hypot(candidate.x - placed.point.x, candidate.y - placed.point.y)
      )
    );

    return candidateDistance > bestDistance ? candidate : best;
  });
}

/** Places actors without persisting coordinates in EncounterState. */
export function getFlexActorPoints(
  actors: FlexActor[],
  polygon: LayoutPoint[],
  center = getPolygonCenter(polygon)
): LayoutPoint[] {
  if (actors.length === 0) {
    return [];
  }

  if (actors.length === 1) {
    return [center];
  }

  const placedActors: PlacedActor[] = [];

  actors.forEach((actor) => {
    const point = chooseCandidate(actor, polygon, center, placedActors);
    placedActors.push({ ...actor, point });
  });

  return placedActors.map(({ point }) => point);
}
