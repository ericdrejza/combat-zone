import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type { EncounterState } from '@core/encounter/types';
import { getActorEngagement } from '@core/encounter/inspectors';
import type { LayoutPoint } from '@core/layout/types';
import type { ActorDragState } from '../canvasInteractionTypes';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import {
  findActorIdAtPoint,
  findEngagementIdAtPoint
} from './engagementHitTesting';

export const ENGAGEMENT_INTENT_DELAY_MS = 500;

export type EngagementHoverTarget = {
  actorId?: string;
  engagementId?: string;
};

/** Owns the cancellable 500ms hold required before a drag becomes an engage. */
export function useEngagementHoverIntent(
  encounter: EncounterState,
  placements: ActorRenderPlacement[],
  setActorDrag: Dispatch<SetStateAction<ActorDragState | null>>
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<string | null>(null);
  const clearIntent = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    targetRef.current = null;
  };
  useEffect(() => clearIntent, []);
  const updateIntent = (drag: ActorDragState, point: LayoutPoint) => {
    const targetActorId = findActorIdAtPoint(placements, point, drag.actorIds);
    const actorEngagement = targetActorId
      ? getActorEngagement(encounter, targetActorId)
      : undefined;
    const tokenEngagementId = findEngagementIdAtPoint(
      encounter,
      placements,
      point
    );
    const candidateEngagementId = actorEngagement?.id ?? tokenEngagementId;
    const isSameEngagement =
      candidateEngagementId !== undefined &&
      drag.actorIds.every(
        (actorId) =>
          getActorEngagement(encounter, actorId)?.id === candidateEngagementId
      );
    const engagementId = isSameEngagement
      ? undefined
      : candidateEngagementId;
    const actorId = candidateEngagementId ? undefined : targetActorId;
    const targetKey = engagementId
      ? `engagement:${engagementId}`
      : actorId
        ? `actor:${actorId}`
        : null;

    if (targetKey && targetRef.current === targetKey) {
      return { actorId, engagementId };
    }
    clearIntent();
    const alreadySignaled =
      (actorId !== undefined &&
        actorId === drag.engagementIntentActorId) ||
      (engagementId !== undefined &&
        engagementId === drag.engagementIntentEngagementId);
    if (targetKey && !alreadySignaled) {
      const heldTarget = targetKey;
      targetRef.current = targetKey;
      timerRef.current = setTimeout(() => {
        setActorDrag((current) =>
          current && targetRef.current === heldTarget
            ? {
                ...current,
                engagementIntentActorId: actorId,
                engagementIntentEngagementId: engagementId
              }
            : current
        );
      }, ENGAGEMENT_INTENT_DELAY_MS);
    }
    return { actorId, engagementId };
  };
  return { clearIntent, updateIntent };
}
