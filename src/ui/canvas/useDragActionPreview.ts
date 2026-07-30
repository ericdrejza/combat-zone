import { useEffect } from 'react';

import { getActorEngagement } from '@core/encounter/inspectors';
import type { EncounterState } from '@core/encounter/types';
import { setDragActionPreview } from '@interaction/interactionState';
import type { AppDispatch } from '@store/store';
import type {
  ActorDragState,
  EngagementDragState
} from './canvasInteractionTypes';
import { isWithinEngagementTether } from './engagements/engagementDragRules';

/** Bridges canvas-local drag intent to the toolbar's ephemeral action state. */
export function useDragActionPreview(
  dispatch: AppDispatch,
  encounter: EncounterState,
  actorDrag: ActorDragState | null,
  engagementDrag: EngagementDragState | null
) {
  const engagementHoverActive =
    engagementDrag?.phase === 'dragging' &&
    Boolean(engagementDrag.hoverTargetEngagementId);
  const actorEngagementHoverActive =
    actorDrag?.phase === 'dragging' &&
    Boolean(
      actorDrag.engagementIntentActorId ??
      actorDrag.engagementIntentEngagementId
    );
  const actorDisengageActive =
    actorDrag?.phase === 'dragging' &&
    Boolean(getActorEngagement(encounter, actorDrag.actorId)) &&
    !isWithinEngagementTether(actorDrag.start, actorDrag.current);
  const preview =
    engagementHoverActive || actorEngagementHoverActive
      ? 'engage'
      : actorDisengageActive
        ? 'disengage'
        : null;

  useEffect(() => {
    dispatch(setDragActionPreview(preview));
  }, [dispatch, preview]);

  useEffect(
    () => () => {
      dispatch(setDragActionPreview(null));
    },
    [dispatch]
  );
}
