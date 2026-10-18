import { ApiContractValidationError } from './errors.js';

/** Validate the persisted appearance preferences; absolute route geometry remains derived. */
export function validateEdgeAppearance(edge: Record<string, unknown>): void {
  if (edge.color !== undefined && edge.color !== null &&
      (typeof edge.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(edge.color))) {
    throw new ApiContractValidationError('Edge color is invalid.');
  }
  if (edge.routePreferences === undefined) return;
  const preferences = edge.routePreferences as Record<string, unknown> | null;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences) ||
      typeof preferences.flipped !== 'boolean' || typeof preferences.curvature !== 'number' ||
      !Number.isFinite(preferences.curvature) || preferences.curvature < 0) {
    throw new ApiContractValidationError('Edge route preferences are invalid.');
  }
}
