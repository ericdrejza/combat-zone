import { useRef, useState } from 'react';

import { createEncounterActionRecord } from '@core/history/createEncounterActionRecord';
import type { EncounterState } from '@core/encounter/types';
import type { LayoutPoint } from '@core/layout/types';
import { prepareValidatedEncounterChangeForRuntime } from '@core/validation/validatedEncounterChange';
import { mergeEngagements } from '@entities/engagement/engagementMutations';
import { selectEntity } from '@interaction/interactionState';
import { commitEncounterChange } from '@store/encounterSlice';
import type { AppDispatch } from '@store/store';
import type { ActorRenderPlacement } from '../actors/actorCanvasLayout';
import type { EngagementDragState } from '../canvasInteractionTypes';
import { findEngagementIdAtPoint } from './engagementHitTesting';

/** Keeps engagement-token drag/merge mutation flow out of CanvasShell. */
export function useEngagementDrag(
  dispatch: AppDispatch,
  encounter: EncounterState,
  placements: ActorRenderPlacement[]
) {
  const [engagementDrag, setEngagementDrag] =
    useState<EngagementDragState | null>(null);
  const engagementDragRef = useRef<EngagementDragState | null>(null);
  const currentPointRef = useRef<LayoutPoint | null>(null);
  const updateDragState = (next: EngagementDragState | null) => {
    engagementDragRef.current = next;
    setEngagementDrag(next);
  };
  const handleEngagementSelect = (
    engagementId: string,
    toggle = false
  ) => {
    const engagement = encounter.engagements.byId[engagementId];
    dispatch(
      selectEntity({
        entityType: 'actor',
        ids: engagement?.participantIds ?? [],
        toggle
      })
    );
  };
  const handleEngagementDragStart = (
    engagementId: string,
    point: LayoutPoint
  ) => {
    currentPointRef.current = point;
    updateDragState({
      current: point,
      engagementId,
      hasMoved: false,
      phase: 'dragging',
      start: point
    });
  };
  const handleEngagementDrag = (point: LayoutPoint) => {
    currentPointRef.current = point;
    const targetId = findEngagementIdAtPoint(encounter, placements, point);
    const drag = engagementDragRef.current;
    if (!drag || drag.phase !== 'dragging') return;
    const hoverTargetEngagementId =
      targetId && targetId !== drag.engagementId ? targetId : undefined;
    if (drag.hoverTargetEngagementId !== hoverTargetEngagementId) {
      updateDragState({ ...drag, hoverTargetEngagementId });
    }
  };
  const handleEngagementDragEnd = () => {
    const drag = engagementDragRef.current;
    if (!drag) return;
    const current = currentPointRef.current ?? drag.start;
    const hasMoved =
      Math.hypot(
        current.x - drag.start.x,
        current.y - drag.start.y
      ) >= 1;
    if (!hasMoved) {
      currentPointRef.current = null;
      updateDragState(null);
      return;
    }
    const targetId = findEngagementIdAtPoint(encounter, placements, current);
    if (!targetId || targetId === drag.engagementId) {
      updateDragState({
        ...drag,
        current,
        hasMoved: true,
        phase: 'returning'
      });
      return;
    }
    const nextEncounter = mergeEngagements(
      encounter,
      drag.engagementId,
      targetId
    );
    if (nextEncounter === encounter) {
      updateDragState({
        ...drag,
        current,
        hasMoved: true,
        phase: 'returning'
      });
      return;
    }
    const prepared = prepareValidatedEncounterChangeForRuntime({
      action: createEncounterActionRecord('engagement.merge', {
        sourceEngagementId: drag.engagementId,
        targetEngagementId: targetId
      }),
      currentEncounter: encounter,
      nextEncounter
    });
    const commit = (resolved: Awaited<typeof prepared>) => {
      if (!resolved.blocked) {
        dispatch(
          commitEncounterChange({
            action: resolved.action,
            nextEncounter: resolved.nextEncounter
          })
        );
        currentPointRef.current = null;
        updateDragState(null);
      } else {
        updateDragState({
          ...drag,
          current,
          hasMoved: true,
          phase: 'returning'
        });
      }
    };
    if (prepared instanceof Promise) void prepared.then(commit); else commit(prepared);
  };
  const handleEngagementDragReturnComplete = () => {
    currentPointRef.current = null;
    updateDragState(null);
  };
  return {
    engagementDrag,
    handleEngagementDrag,
    handleEngagementDragEnd,
    handleEngagementDragReturnComplete,
    handleEngagementDragStart,
    handleEngagementSelect
  };
}
