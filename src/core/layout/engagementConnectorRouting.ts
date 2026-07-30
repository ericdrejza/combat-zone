import {
  type EngagementParticipantPoint
} from './engagementPacking';
import {
  ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE,
  ENGAGEMENT_MINIMUM_CLEARANCE,
  ENGAGEMENT_TOKEN_RADIUS
} from './engagementGeometryConstants';
import type { LayoutPoint } from './types';
import {
  engagementFootprintsAreSeparate,
  engagementSegmentClearsFootprint
} from './engagementFootprintGeometry';
import {
  distanceToSegment,
  GEOMETRY_EPSILON
} from './polygonGeometry';

export type EngagementConnector = {
  actorId: string;
  from: LayoutPoint;
  to: LayoutPoint;
  viaActorId?: string;
};

export type EngagementConnectorGroup = {
  engagementId: string;
  participants: EngagementParticipantPoint[];
  token: LayoutPoint;
};

function pathAvoidsActors(
  start: LayoutPoint,
  end: LayoutPoint,
  actors: readonly EngagementParticipantPoint[],
  ignoredIds: readonly string[]
): boolean {
  const ignored = new Set(ignoredIds);
  return actors.every(
    (actor) =>
      ignored.has(actor.actorId) ||
      engagementSegmentClearsFootprint(
        start,
        end,
        actor,
        ENGAGEMENT_MINIMUM_CLEARANCE
      )
  );
}

function segmentsCross(
  start: LayoutPoint,
  end: LayoutPoint,
  otherStart: LayoutPoint,
  otherEnd: LayoutPoint
): boolean {
  const samePoint = (left: LayoutPoint, right: LayoutPoint) =>
    left.x === right.x && left.y === right.y;
  if (
    [start, end].some(
      (point) => samePoint(point, otherStart) || samePoint(point, otherEnd)
    )
  ) {
    return false;
  }
  const cross = (a: LayoutPoint, b: LayoutPoint, c: LayoutPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const first = cross(start, end, otherStart);
  const second = cross(start, end, otherEnd);
  const third = cross(otherStart, otherEnd, start);
  const fourth = cross(otherStart, otherEnd, end);
  const strictlyCrosses =
    ((first > 0 && second < 0) || (first < 0 && second > 0)) &&
    ((third > 0 && fourth < 0) || (third < 0 && fourth > 0));
  const onSegment = (a: LayoutPoint, b: LayoutPoint, point: LayoutPoint) =>
    Math.abs(cross(a, b, point)) < 0.0001 &&
    point.x >= Math.min(a.x, b.x) &&
    point.x <= Math.max(a.x, b.x) &&
    point.y >= Math.min(a.y, b.y) &&
    point.y <= Math.max(a.y, b.y);
  return (
    strictlyCrosses ||
    onSegment(start, end, otherStart) ||
    onSegment(start, end, otherEnd) ||
    onSegment(otherStart, otherEnd, start) ||
    onSegment(otherStart, otherEnd, end)
  );
}

function pathAvoidsConnectors(
  start: LayoutPoint,
  end: LayoutPoint,
  connectors: readonly EngagementConnector[]
): boolean {
  return connectors.every(
    (connector) => {
      const sharesEndpoint = [start, end].some((point) =>
        [connector.from, connector.to].some(
          (other) => point.x === other.x && point.y === other.y
        )
      );
      if (sharesEndpoint) return true;
      const distance = Math.min(
        distanceToSegment(start, connector.from, connector.to),
        distanceToSegment(end, connector.from, connector.to),
        distanceToSegment(connector.from, start, end),
        distanceToSegment(connector.to, start, end)
      );
      return (
        !segmentsCross(start, end, connector.from, connector.to) &&
        distance + GEOMETRY_EPSILON >= ENGAGEMENT_MINIMUM_CLEARANCE
      );
    }
  );
}

/**
 * Builds one connector per reachable participant, preferring token spokes and
 * then chaining outward through already connected actors.
 */
export function routeEngagementConnectors(
  token: LayoutPoint,
  participants: readonly EngagementParticipantPoint[],
  options: {
    obstacles?: readonly EngagementParticipantPoint[];
    existingConnectors?: readonly EngagementConnector[];
  } = {}
): EngagementConnector[] {
  const obstacles = options.obstacles ?? participants;
  const participantOrder = new Map(
    participants.map(({ actorId }, index) => [actorId, index])
  );
  const connected: EngagementParticipantPoint[] = [];
  const pending = [...participants].sort(
    (left, right) =>
      Math.hypot(left.point.x - token.x, left.point.y - token.y) -
        Math.hypot(right.point.x - token.x, right.point.y - token.y) ||
      left.actorId.localeCompare(right.actorId)
  );
  const connectors: EngagementConnector[] = [
    ...(options.existingConnectors ?? [])
  ];
  const ownConnectors: EngagementConnector[] = [];

  while (pending.length) {
    const directCandidates = pending.flatMap(
      (participant, pendingIndex) =>
        pathAvoidsActors(token, participant.point, obstacles, [
          participant.actorId
        ]) &&
        pathAvoidsConnectors(token, participant.point, connectors)
          ? [{
              distance: Math.hypot(
                participant.point.x - token.x,
                participant.point.y - token.y
              ),
              participant,
              pendingIndex
            }]
          : []
    );
    const branchCandidates = pending.flatMap((participant, pendingIndex) =>
      connected.flatMap((parent) =>
        pathAvoidsActors(parent.point, participant.point, obstacles, [
          parent.actorId,
          participant.actorId
        ]) &&
        engagementFootprintsAreSeparate(
          parent,
          participant,
          ENGAGEMENT_CHAIN_VISIBLE_CLEARANCE
        ) &&
        pathAvoidsConnectors(parent.point, participant.point, connectors)
          ? [{
              distance: Math.hypot(
                parent.point.x - participant.point.x,
                parent.point.y - participant.point.y
              ),
              parent,
              participant,
              pendingIndex
            }]
          : []
      )
    );
    const choices: Array<{
      distance: number;
      from: LayoutPoint;
      participant: EngagementParticipantPoint;
      pendingIndex: number;
      viaActorId?: string;
    }> = [
      ...directCandidates.map((candidate) => ({
        ...candidate,
        from: token
      })),
      ...branchCandidates.map((candidate) => ({
        ...candidate,
        from: candidate.parent.point,
        viaActorId: candidate.parent.actorId
      }))
    ];
    const choice = choices.sort(
      (left, right) =>
        left.distance - right.distance ||
        left.participant.actorId.localeCompare(right.participant.actorId) ||
        (left.viaActorId ?? '').localeCompare(right.viaActorId ?? '')
    )[0];
    if (!choice) break;

    pending.splice(choice.pendingIndex, 1);
    const connector = {
      actorId: choice.participant.actorId,
      from: choice.from,
      to: choice.participant.point,
      ...(choice.viaActorId ? { viaActorId: choice.viaActorId } : {})
    };
    connectors.push(connector);
    ownConnectors.push(connector);
    connected.push(choice.participant);
  }

  return ownConnectors.sort(
    (left, right) =>
      (participantOrder.get(left.actorId) ?? 0) -
      (participantOrder.get(right.actorId) ?? 0)
  );
}

export function hasCompleteEngagementConnectorNetwork(
  participants: readonly EngagementParticipantPoint[],
  connectors: readonly EngagementConnector[]
): boolean {
  const connectedActorIds = new Set(
    connectors.map((connector) => connector.actorId)
  );
  return participants.every(({ actorId }) => connectedActorIds.has(actorId));
}

/** Routes groups in stable order so rendering and validation share obstacles. */
export function routeEngagementConnectorGroups(
  groups: readonly EngagementConnectorGroup[],
  actorObstacles: readonly EngagementParticipantPoint[]
): {
  complete: boolean;
  connectorsByEngagementId: Readonly<Record<string, EngagementConnector[]>>;
} {
  const orderedGroups = groups.map((group, index) => ({
    group,
    index,
    area: group.participants.reduce(
      (total, participant) =>
        total +
        (participant.shape === 'rectangle'
          ? (participant.radius * 2) ** 2
          : Math.PI * participant.radius ** 2),
      Math.PI * ENGAGEMENT_TOKEN_RADIUS ** 2
    )
  })).sort(
    (left, right) => right.area - left.area || left.index - right.index
  ).map(({ group }) => group);
  const tokenObstacles = orderedGroups.map((group) => ({
    actorId: `engagement-token:${group.engagementId}`,
    point: group.token,
    radius: ENGAGEMENT_TOKEN_RADIUS
  }));
  const acceptedConnectors: EngagementConnector[] = [];
  const connectorsByEngagementId: Record<string, EngagementConnector[]> = {};
  let complete = true;

  orderedGroups.forEach((group) => {
    const connectors = routeEngagementConnectors(
      group.token,
      group.participants,
      {
        existingConnectors: acceptedConnectors,
        obstacles: [
          ...actorObstacles,
          ...tokenObstacles.filter(
            ({ actorId }) =>
              actorId !== `engagement-token:${group.engagementId}`
          )
        ]
      }
    );
    connectorsByEngagementId[group.engagementId] = connectors;
    acceptedConnectors.push(...connectors);
    complete =
      complete &&
      hasCompleteEngagementConnectorNetwork(group.participants, connectors);
  });

  return { complete, connectorsByEngagementId };
}
