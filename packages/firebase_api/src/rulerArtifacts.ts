const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Shared JSON contract for persisted ruler artifacts, independent of rendering or Redux. */
export function validRulerArtifact(value: unknown): boolean {
  if (!record(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !record(value.options)) return false;
  if (!['path', 'circle', 'cone', 'rectangle', 'line'].includes(String(value.options.shape)) ||
    (value.options.angle !== undefined && (!finite(value.options.angle) || value.options.angle < 1 || value.options.angle > 180))) return false;
  const options = value.options;
  if (['showDistance', 'highlightActors'].some(key => options[key] !== undefined && typeof options[key] !== 'boolean')) return false;
  return Array.isArray(value.points) && value.points.length >= 2 && value.points.every(p => record(p) && finite(p.x) && finite(p.y))
    && (value.color === null || typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color))
    && (value.opacity === null || finite(value.opacity) && value.opacity >= 0 && value.opacity <= 1);
}
export function validRulerCollection(value: unknown): boolean {
  if (!record(value) || !record(value.byId) || !Array.isArray(value.allIds)) return false;
  const ids = value.allIds, byId = value.byId;
  return ids.every(id => typeof id === 'string' && id.length > 0) && new Set(ids).size === ids.length
    && Object.keys(byId).length === ids.length && ids.every(id => record(byId[id]) && byId[id].id === id && validRulerArtifact(byId[id]));
}
