import type { LayoutPoint } from '@core/layout/types';

const optimisticPlacements = new Map<string, LayoutPoint>();

/**
 * Keeps an actor visible at the user's drop point while worker packing is in
 * flight. This is transient render state; the worker remains authoritative.
 */
export function setOptimisticActorPlacement(
  actorId: string,
  point: LayoutPoint
): void {
  optimisticPlacements.set(actorId, point);
}

export function getOptimisticActorPlacement(
  actorId: string
): LayoutPoint | undefined {
  return optimisticPlacements.get(actorId);
}

export function clearOptimisticActorPlacement(actorId: string): void {
  optimisticPlacements.delete(actorId);
}

export function clearOptimisticActorPlacements(): void {
  optimisticPlacements.clear();
}
