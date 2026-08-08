import {
  EDGE_OBSTACLE_CLEARANCE,
  getEdgeLanePlacement,
  getCardinalPathArrowAngle,
  offsetRouteForLane,
  pointAlongRoute,
  routeEdge,
  routeToSvgPath
} from "@entities/edge/edgeRouting";
import type { Edge } from "@entities/edge/types";

const rectangle = (x: number, y: number, width: number, height: number) => [
  { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }
];

describe("edge routing", () => {
  it("uses closest boundary anchors for a direct route", () => {
    const route = routeEdge({ fromPolygon: rectangle(20, 40, 80, 80), obstaclePolygons: [], shape: "straight", toPolygon: rectangle(300, 40, 80, 80) });
    expect(route).toMatchObject({ clearance: EDGE_OBSTACLE_CLEARANCE, valid: true });
    expect(route.path).toEqual([{ x: 100, y: 80 }, { x: 300, y: 80 }]);
  });

  it("spreads pair lanes onto distinct Zone boundary anchors", () => {
    const from = rectangle(20, 40, 80, 80);
    const to = rectangle(300, 40, 80, 80);
    const route = [{ x: 100, y: 80 }, { x: 300, y: 80 }];
    const upper = offsetRouteForLane(route, from, to, -4);
    const lower = offsetRouteForLane(route, from, to, 4);

    expect(upper).toEqual([{ x: 100, y: 76 }, { x: 300, y: 76 }]);
    expect(lower).toEqual([{ x: 100, y: 84 }, { x: 300, y: 84 }]);
    expect(upper[0]).not.toEqual(lower[0]);
    expect(upper[1]).not.toEqual(lower[1]);
  });

  it("keeps both unilateral directions on opposite anchors around a bilateral edge", () => {
    const edge = (
      id: string,
      fromZoneId: string,
      toZoneId: string,
      directionality: Edge["directionality"]
    ): Edge => ({
      directionality,
      fromZoneId,
      id,
      interactionTags: [],
      movementRules: [],
      shape: "straight",
      toZoneId,
      visibilityRule: "visible"
    });
    const forward = edge("forward", "a", "b", "unilateral");
    const bilateral = edge("bilateral", "a", "b", "bilateral");
    const reverse = edge("reverse", "b", "a", "unilateral");
    const siblings = [forward, bilateral, reverse];
    const from = rectangle(20, 40, 80, 80);
    const to = rectangle(300, 40, 80, 80);
    const forwardRoute = offsetRouteForLane(
      [{ x: 100, y: 80 }, { x: 300, y: 80 }],
      from,
      to,
      getEdgeLanePlacement(forward, siblings).routeOffset
    );
    const bilateralRoute = offsetRouteForLane(
      [{ x: 100, y: 80 }, { x: 300, y: 80 }],
      from,
      to,
      getEdgeLanePlacement(bilateral, siblings).routeOffset
    );
    const reverseRoute = offsetRouteForLane(
      [{ x: 300, y: 80 }, { x: 100, y: 80 }],
      to,
      from,
      getEdgeLanePlacement(reverse, siblings).routeOffset
    );

    expect(forwardRoute).toEqual([{ x: 100, y: 68 }, { x: 300, y: 68 }]);
    expect(bilateralRoute).toEqual([{ x: 100, y: 80 }, { x: 300, y: 80 }]);
    expect(reverseRoute).toEqual([{ x: 300, y: 92 }, { x: 100, y: 92 }]);
    expect(new Set([
      forwardRoute[0].y,
      bilateralRoute[0].y,
      reverseRoute[1].y
    ])).toHaveLength(3);
    expect(pointAlongRoute(
      forwardRoute,
      getEdgeLanePlacement(forward, siblings).badgeFraction
    )?.x).toBe(184);
    expect(pointAlongRoute(
      reverseRoute,
      getEdgeLanePlacement(reverse, siblings).badgeFraction
    )?.x).toBe(216);
  });

  it("places route badges by traveled distance instead of at an endpoint", () => {
    expect(pointAlongRoute([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 100, y: 0 }], 0.5)).toEqual({ x: 50, y: 0 });
  });

  it("quantizes right-angle arrows to the dominant path direction", () => {
    expect(getCardinalPathArrowAngle({ x: 100, y: -20 })).toBe(0);
    expect(getCardinalPathArrowAngle({ x: -100, y: 20 })).toBe(180);
    expect(getCardinalPathArrowAngle({ x: 20, y: 100 })).toBe(90);
    expect(getCardinalPathArrowAngle({ x: -20, y: -100 })).toBe(-90);
  });

  it("uses the shortest orthogonal span when facing sides overlap", () => {
    const route = routeEdge({
      fromPolygon: rectangle(20, 40, 80, 80),
      obstaclePolygons: [],
      shape: "straight",
      toPolygon: rectangle(300, 90, 80, 140)
    });

    expect(route.path).toEqual([{ x: 100, y: 120 }, { x: 300, y: 120 }]);
  });

  it("keeps an orthogonal right-angle edge straight", () => {
    const route = routeEdge({
      fromPolygon: rectangle(20, 40, 80, 80),
      obstaclePolygons: [],
      shape: "rightAngled",
      toPolygon: rectangle(300, 90, 80, 140)
    });

    expect(route.path).toEqual([{ x: 100, y: 120 }, { x: 300, y: 120 }]);
  });

  it("adds right-angle turns when an obstacle blocks the orthogonal span", () => {
    const route = routeEdge({
      fromPolygon: rectangle(20, 40, 80, 80),
      obstaclePolygons: [rectangle(170, 70, 60, 100)],
      shape: "rightAngled",
      toPolygon: rectangle(300, 90, 80, 140)
    });

    expect(route.valid).toBe(true);
    expect(route.path.length).toBeGreaterThan(2);
    expect(route.path.slice(1).every((point, index) =>
      point.x === route.path[index].x || point.y === route.path[index].y
    )).toBe(true);
  });

  it("uses at most one turn for an unobstructed diagonal right-angle edge", () => {
    const route = routeEdge({
      fromPolygon: rectangle(20, 200, 80, 80),
      obstaclePolygons: [],
      shape: "rightAngled",
      toPolygon: rectangle(300, 40, 80, 80)
    });

    expect(route.valid).toBe(true);
    expect(route.path.length).toBeLessThanOrEqual(3);
  });

  it("starts a direct curve toward a diagonally positioned target", () => {
    const upRight = routeToSvgPath(
      [{ x: 100, y: 200 }, { x: 300, y: 80 }],
      "curved"
    );
    const control = upRight.match(/Q ([\d.-]+) ([\d.-]+)/);

    expect(Number(control?.[1])).toBeGreaterThan(100);
    expect(Number(control?.[2])).toBeLessThan(200);
  });

  it("scales direct curvature with route distance", () => {
    const controlOffset = (end: number) => {
      const path = routeToSvgPath(
        [{ x: 0, y: 0 }, { x: end, y: end }],
        "curved"
      );
      const control = path.match(/Q ([\d.-]+) ([\d.-]+)/);
      return Math.hypot(
        Number(control?.[1]) - end / 2,
        Number(control?.[2]) - end / 2
      );
    };

    expect(controlOffset(300)).toBeGreaterThan(controlOffset(100));
  });

  it("uses obstacle waypoints to guide a curved route", () => {
    const route = routeEdge({
      fromPolygon: rectangle(20, 200, 80, 80),
      obstaclePolygons: [rectangle(180, 150, 100, 180)],
      shape: "curved",
      toPolygon: rectangle(420, 200, 80, 80)
    });

    expect(route.path.length).toBeGreaterThan(2);
    expect(routeToSvgPath(route.path, "curved")).toContain(" Q ");
  });

  it("routes around an obstacle and creates orthogonal segments", () => {
    const input = { fromPolygon: rectangle(20, 200, 80, 80), obstaclePolygons: [rectangle(180, 150, 100, 180)], toPolygon: rectangle(420, 200, 80, 80) };
    const straight = routeEdge({ ...input, shape: "straight" });
    const orthogonal = routeEdge({ ...input, shape: "rightAngled" });
    expect(straight.valid).toBe(true);
    expect(straight.path.length).toBeGreaterThan(2);
    expect(orthogonal.path.slice(1).every((point, index) => point.x === orthogonal.path[index].x || point.y === orthogonal.path[index].y)).toBe(true);
  });

  it("emits distinct SVG commands for every visual shape", () => {
    const path = [{ x: 0, y: 0 }, { x: 100, y: 80 }];
    expect(routeToSvgPath(path, "straight")).toContain(" L ");
    expect(routeToSvgPath(path, "rightAngled")).toContain(" L ");
    expect(routeToSvgPath(path, "curved")).toContain(" Q ");
    expect(routeToSvgPath(path, "sigmoid")).toContain(" C ");
  });

  it("reports no route when a zone completely divides the canvas", () => {
    const route = routeEdge({ fromPolygon: rectangle(100, 50, 80, 80), obstaclePolygons: [rectangle(0, 250, 960, 140)], shape: "straight", toPolygon: rectangle(100, 500, 80, 80) });
    expect(route.valid).toBe(false);
    expect(route.path).toEqual([]);
  });
});
