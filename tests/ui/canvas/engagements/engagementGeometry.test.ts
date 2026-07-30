import { describe, expect, it } from 'vitest';
import { getEngagementTokenPoint, routeEngagementConnectors } from '@ui/canvas/engagements/engagementGeometry';

describe('engagement connector routing', () => {
  it('uses the token as the shared direct endpoint when paths are clear', () => {
    const participants = [
      { actorId: 'a', point: { x: 20, y: 50 }, radius: 10 },
      { actorId: 'b', point: { x: 80, y: 50 }, radius: 10 }
    ];
    const token = getEngagementTokenPoint(participants);
    expect(Math.hypot(token.x - participants[0].point.x, token.y - participants[0].point.y)).toBeGreaterThanOrEqual(24);
    expect(Math.hypot(token.x - participants[1].point.x, token.y - participants[1].point.y)).toBeGreaterThanOrEqual(24);
    expect(routeEngagementConnectors(token, participants)).toEqual([
      { actorId: 'a', from: token, to: participants[0].point },
      { actorId: 'b', from: token, to: participants[1].point }
    ]);
  });

  it('falls back to a participant network when another actor blocks a token spoke', () => {
    const participants = [
      { actorId: 'left', point: { x: 0, y: 0 }, radius: 10 },
      { actorId: 'blocker', point: { x: 50, y: 0 }, radius: 20 },
      { actorId: 'right', point: { x: 100, y: 0 }, radius: 10 }
    ];
    const routes = routeEngagementConnectors({ x: 50, y: 0 }, participants);
    expect(routes).toHaveLength(3);
    expect(routes.some((route) => route.viaActorId)).toBe(true);
  });

  it('does not create independent connector crossings', () => {
    const participants = [
      { actorId: 'north-west', point: { x: 0, y: 100 }, radius: 8 },
      { actorId: 'north-east', point: { x: 100, y: 100 }, radius: 8 },
      { actorId: 'south-west', point: { x: 0, y: 0 }, radius: 8 },
      { actorId: 'south-east', point: { x: 100, y: 0 }, radius: 8 }
    ];
    const routes = routeEngagementConnectors({ x: 50, y: 50 }, participants);
    const crosses = (first: (typeof routes)[number], second: (typeof routes)[number]) => {
      const shared = [first.from, first.to].some((point) =>
        [second.from, second.to].some((other) => point.x === other.x && point.y === other.y)
      );
      if (shared) return false;
      const orientation = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
        (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const [a, b, c, d] = [first.from, first.to, second.from, second.to];
      return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0;
    };
    expect(routes.some((route, index) => routes.slice(index + 1).some((other) => crosses(route, other)))).toBe(false);
  });

  it('omits routes blocked by actors or connectors outside the engagement', () => {
    const participant = {
      actorId: 'member',
      point: { x: 100, y: 50 },
      radius: 10
    };

    expect(
      routeEngagementConnectors({ x: 0, y: 50 }, [participant], {
        obstacles: [
          participant,
          {
            actorId: 'unengaged-obstacle',
            point: { x: 50, y: 50 },
            radius: 12
          }
        ]
      })
    ).toEqual([]);
    expect(
      routeEngagementConnectors({ x: 0, y: 0 }, [
        { ...participant, point: { x: 100, y: 100 } }
      ], {
        existingConnectors: [
          {
            actorId: 'other-engagement-member',
            from: { x: 0, y: 100 },
            to: { x: 100, y: 0 }
          }
        ]
      })
    ).toEqual([]);
  });

  it('rejects a connector whose 2px stroke would overlap a parallel line', () => {
    const participant = {
      actorId: 'member',
      point: { x: 100, y: 0 },
      radius: 10
    };

    expect(
      routeEngagementConnectors({ x: 0, y: 0 }, [participant], {
        existingConnectors: [{
          actorId: 'other',
          from: { x: 0, y: 1 },
          to: { x: 100, y: 1 }
        }]
      })
    ).toEqual([]);
    expect(
      routeEngagementConnectors({ x: 0, y: 0 }, [participant], {
        existingConnectors: [{
          actorId: 'other',
          from: { x: 0, y: 2 },
          to: { x: 100, y: 2 }
        }]
      })
    ).toHaveLength(1);
  });

  it('treats other engagement tokens as connector obstacles', () => {
    const participant = {
      actorId: 'member',
      point: { x: 120, y: 50 },
      radius: 10
    };
    const routes = routeEngagementConnectors(
      { x: 0, y: 50 },
      [participant],
      {
        obstacles: [
          participant,
          {
            actorId: 'engagement-token:other',
            point: { x: 60, y: 50 },
            radius: 12
          }
        ]
      }
    );

    expect(routes).toEqual([]);
  });

  it('keeps the 24px token clear of mixed-size participant footprints', () => {
    const participants = [
      { actorId: 'large', point: { x: 100, y: 100 }, radius: 45 },
      { actorId: 'small', point: { x: 190, y: 100 }, radius: 15 },
      { actorId: 'medium', point: { x: 145, y: 180 }, radius: 30 }
    ];
    const token = getEngagementTokenPoint(participants, [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]);
    participants.forEach((participant) => {
      expect(Math.hypot(token.x - participant.point.x, token.y - participant.point.y)).toBeGreaterThanOrEqual(participant.radius + 12 + 2);
    });
  });
});
