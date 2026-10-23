import { engagementFootprintsAreSeparate, type EngagementFootprint } from "@core/layout/engagementFootprintGeometry";
import type { EncounterState } from "@core/encounter/types";
import type { LayoutPoint } from "@core/layout/types";
import { footprintFits, spatialActorRadius } from "./gridGeometry";

const GAP = 10;
type Footprint = EngagementFootprint;

/** Session transfer planning only: reserve footprints before making one atomic mutation. */
export function packZonelessActors(state: EncounterState, ids: string[], requested: LayoutPoint): Record<string, LayoutPoint> | null {
  const moving = new Set(ids);
  const occupied: Footprint[] = state.actors.allIds.flatMap(id => {
    const actor = state.actors.byId[id];
    return !moving.has(id) && actor.spatialPosition ? [{ point: actor.spatialPosition, radius: spatialActorRadius(actor), shape: actor.shape }] : [];
  });
  const positions: Record<string, LayoutPoint> = {};
  for (const id of ids) {
    const actor = state.actors.byId[id];
    if (!actor) return null;
    const radius = spatialActorRadius(actor);
    if (radius * 2 > Math.min(state.canvasSize.width, state.canvasSize.height)) return null;
    const clamp = (p: LayoutPoint) => ({ x: Math.max(radius, Math.min(state.canvasSize.width - radius, p.x)),
      y: Math.max(radius, Math.min(state.canvasSize.height - radius, p.y)) });
    const candidates: LayoutPoint[] = [clamp(requested)];
    // Tangent samples give close packing; the canvas lattice also searches free areas
    // when obstacles block the release point. Neither changes the encounter's grid.
    for (const other of occupied) {
      const distance = radius + other.radius + GAP;
      for (const dx of [-distance, 0, distance]) for (const dy of [-distance, 0, distance]) {
        candidates.push(clamp({ x: other.point.x + dx, y: other.point.y + dy }));
      }
      for (let angle = 0; angle < 32; angle++) {
        candidates.push(clamp({ x: other.point.x + Math.cos(angle * Math.PI / 16) * distance,
          y: other.point.y + Math.sin(angle * Math.PI / 16) * distance }));
      }
    }
    const step = Math.max(10, radius);
    for (let y = radius; y <= state.canvasSize.height - radius; y += step) {
      for (let x = radius; x <= state.canvasSize.width - radius; x += step) candidates.push({ x, y });
    }
    candidates.sort((a, b) => {
      const distance = Math.hypot(a.x - requested.x, a.y - requested.y) - Math.hypot(b.x - requested.x, b.y - requested.y);
      return Math.abs(distance) > 1e-7 ? distance : a.y - b.y || a.x - b.x;
    });
    const point = candidates.find(p => footprintFits(p, radius, state.canvasSize) && occupied.every(other =>
      engagementFootprintsAreSeparate({ point: p, radius, shape: actor.shape }, other, GAP)));
    if (!point) return null;
    positions[id] = point;
    occupied.push({ point, radius, shape: actor.shape });
  }
  return positions;
}
