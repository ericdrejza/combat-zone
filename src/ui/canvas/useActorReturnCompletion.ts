import { useCallback, useRef } from "react";

import type { ActorDragState } from "./canvasInteractionTypes";

type CompletionState = {
  actorIds: Set<string>;
  key: string;
};

/** Coordinates multi-actor return animations before clearing their shared drag. */
export function useActorReturnCompletion(
  actorDrag: ActorDragState | null,
  clearActorDrag: () => void
) {
  const completionRef = useRef<CompletionState>({
    actorIds: new Set<string>(),
    key: ""
  });

  const handleActorReturnComplete = useCallback(
    (actorId: string) => {
      if (!actorDrag || actorDrag.phase !== "returning") {
        return;
      }

      const completionKey = `${actorDrag.actorId}:${actorDrag.actorIds.join(",")}:${actorDrag.start.x}:${actorDrag.start.y}`;

      if (completionRef.current.key !== completionKey) {
        completionRef.current = {
          actorIds: new Set<string>(),
          key: completionKey
        };
      }

      completionRef.current.actorIds.add(actorId);

      if (
        actorDrag.actorIds.every((draggedActorId) =>
          completionRef.current.actorIds.has(draggedActorId)
        )
      ) {
        clearActorDrag();
      }
    },
    [actorDrag, clearActorDrag]
  );

  const resetActorReturnCompletion = useCallback(() => {
    completionRef.current = {
      actorIds: new Set<string>(),
      key: ""
    };
  }, []);

  return { handleActorReturnComplete, resetActorReturnCompletion };
}
