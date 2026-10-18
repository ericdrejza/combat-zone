import type { LayoutPoint } from "@core/layout/types";
const ids = new WeakMap<LayoutPoint[], number>();
let sequence = 0;

/** Encounter polygons are immutable; worker sessions retain unchanged identities. */
export function edgeGeometryKey(polygons: LayoutPoint[][]): number[] {
  return polygons.map(polygon => {
    let id = ids.get(polygon);
    if (id === undefined) { id = ++sequence; ids.set(polygon, id); }
    return id;
  });
}
