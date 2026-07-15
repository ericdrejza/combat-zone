import { describe, expect, it } from "vitest";

import { findSmallestRectangularFlexZoneFit } from "./rectangularFlexZoneFit";
import { packRectangularFlexActors } from "./rectangularFlexLayout";

describe("rectangular FLEX zone fitting", () => {
  it("finds a fitting uniform scale while preserving aspect ratio", () => {
    const polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 }
    ];
    const actors = [
      { id: "actor-1", radius: 30, shape: "circle" as const },
      { id: "actor-2", radius: 30, shape: "circle" as const }
    ];

    const fit = findSmallestRectangularFlexZoneFit(polygon, actors);

    expect(fit?.resized).toBe(true);
    expect(fit?.polygon).toBeDefined();

    const fittedPolygon = fit?.polygon ?? [];
    const fittedWidth = fittedPolygon[1].x - fittedPolygon[0].x;
    const fittedHeight = fittedPolygon[2].y - fittedPolygon[1].y;
    expect(fittedWidth / fittedHeight).toBeCloseTo(2);
    expect(
      packRectangularFlexActors({ polygon: fittedPolygon, actors }).fits
    ).toBe(true);
  });
});
