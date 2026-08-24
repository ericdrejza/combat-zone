import { animate } from "motion/react";
import { useEffect, type RefObject } from "react";

const TURN_VISIBILITY_MARGIN_PX = 4;

type VerticalBounds = {
  bottom: number;
  top: number;
};

type TurnScrollTargetOptions = {
  active: VerticalBounds;
  currentScrollTop: number;
  maximumScrollTop: number;
  onDeck?: VerticalBounds;
  viewportHeight: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Prioritizes the active row, then reveals the following row when space permits. */
export function getInitiativeTurnScrollTarget({
  active,
  currentScrollTop,
  maximumScrollTop,
  onDeck,
  viewportHeight
}: TurnScrollTargetOptions): number {
  const activeMinimum = clamp(
    active.bottom + TURN_VISIBILITY_MARGIN_PX - viewportHeight,
    0,
    maximumScrollTop
  );
  const activeMaximum = clamp(
    active.top - TURN_VISIBILITY_MARGIN_PX,
    0,
    maximumScrollTop
  );

  if (activeMinimum > activeMaximum) {
    return activeMaximum;
  }

  if (onDeck) {
    const combinedMinimum = Math.max(
      activeMinimum,
      clamp(
        onDeck.bottom + TURN_VISIBILITY_MARGIN_PX - viewportHeight,
        0,
        maximumScrollTop
      )
    );
    if (combinedMinimum <= activeMaximum) {
      return clamp(currentScrollTop, combinedMinimum, activeMaximum);
    }

    return activeMaximum;
  }

  return clamp(currentScrollTop, activeMinimum, activeMaximum);
}

function findParticipantRow(
  list: HTMLOListElement,
  actorId: string
): HTMLElement | undefined {
  return Array.from(
    list.querySelectorAll<HTMLElement>("[data-initiative-actor-id]")
  ).find((row) => row.dataset.initiativeActorId === actorId);
}

/** Scrolls turn navigation to the active participant and its on-deck neighbor. */
export function useInitiativeTurnAutoScroll(
  listRef: RefObject<HTMLOListElement>,
  actorIds: string[],
  currentActorId: string | null,
  animationsDisabled: boolean
) {
  useEffect(() => {
    const list = listRef.current;
    if (!list || !currentActorId) return;

    const activeIndex = actorIds.indexOf(currentActorId);
    const activeRow = findParticipantRow(list, currentActorId);
    if (activeIndex < 0 || !activeRow) return;

    const onDeckId = actorIds[activeIndex + 1];
    const onDeckRow = onDeckId
      ? findParticipantRow(list, onDeckId)
      : undefined;
    const listBounds = list.getBoundingClientRect();
    const toContentBounds = (row: HTMLElement): VerticalBounds => {
      const bounds = row.getBoundingClientRect();
      return {
        bottom: bounds.bottom - listBounds.top + list.scrollTop,
        top: bounds.top - listBounds.top + list.scrollTop
      };
    };
    const target = getInitiativeTurnScrollTarget({
      active: toContentBounds(activeRow),
      currentScrollTop: list.scrollTop,
      maximumScrollTop: Math.max(0, list.scrollHeight - list.clientHeight),
      onDeck: onDeckRow ? toContentBounds(onDeckRow) : undefined,
      viewportHeight: list.clientHeight
    });
    if (Math.abs(target - list.scrollTop) < 1) return;

    if (animationsDisabled) {
      list.scrollTop = target;
      return;
    }

    const scrollAnimation = animate(list.scrollTop, target, {
      duration: 0.2,
      ease: "easeOut",
      onUpdate: (value) => {
        list.scrollTop = value;
      }
    });
    return () => scrollAnimation.stop();
  }, [animationsDisabled, currentActorId]);
}
