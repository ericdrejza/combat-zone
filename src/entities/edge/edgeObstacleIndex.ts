import { getPolygonBounds } from "@core/layout/polygonGeometry";
import type { LayoutPoint } from "@core/layout/types";

type Bounds = ReturnType<typeof getPolygonBounds>;
const overlaps = (a: Bounds, b: Bounds) => a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
const cached = new WeakMap<LayoutPoint[][], ReturnType<typeof buildIndex>>();

function buildIndex(polygons: LayoutPoint[][]) {
  const size = 256;
  const entries = polygons.map(polygon => ({ polygon, bounds: getPolygonBounds(polygon) }));
  const buckets = new Map<string, Set<typeof entries[number]>>();
  const large: typeof entries = [];
  for (const entry of entries) {
    const { minX, maxX, minY, maxY } = entry.bounds;
    if ((Math.floor(maxX / size) - Math.floor(minX / size) + 1) * (Math.floor(maxY / size) - Math.floor(minY / size) + 1) > 256) { large.push(entry); continue; }
    for (let x = Math.floor(minX / size); x <= Math.floor(maxX / size); x++) for (let y = Math.floor(minY / size); y <= Math.floor(maxY / size); y++) {
      const key = `${x},${y}`;
      if (!buckets.has(key)) buckets.set(key, new Set());
      buckets.get(key)!.add(entry);
    }
  }
  return (bounds: Bounds): LayoutPoint[][] => {
    const x0 = Math.floor(bounds.minX / size), x1 = Math.floor(bounds.maxX / size);
    const y0 = Math.floor(bounds.minY / size), y1 = Math.floor(bounds.maxY / size);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > Math.max(256, buckets.size)) return entries.filter(entry => overlaps(entry.bounds, bounds)).map(entry => entry.polygon);
    const found = new Set(large);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (const entry of buckets.get(`${x},${y}`) ?? []) found.add(entry);
    return [...found].filter(entry => overlaps(entry.bounds, bounds)).map(entry => entry.polygon);
  };
}

/** Conservative broad phase; exact polygon checks still decide every collision. */
export function edgeObstacleQuery(polygons: LayoutPoint[][]) {
  let query = cached.get(polygons);
  if (!query) { query = buildIndex(polygons); cached.set(polygons, query); }
  return query;
}
