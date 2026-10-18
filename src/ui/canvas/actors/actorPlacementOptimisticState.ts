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

export function clearOptimisticActorPlacement(actorId: string, expectedPoint?: LayoutPoint): void {
  // An earlier animation must not consume a newer gesture's retained preview.
  if (expectedPoint) {
    const current = optimisticPlacements.get(actorId);
    if (current?.x !== expectedPoint.x || current?.y !== expectedPoint.y) return;
  }
  optimisticPlacements.delete(actorId);
}

export function clearOptimisticActorPlacements(): void {
  optimisticPlacements.clear();
}
