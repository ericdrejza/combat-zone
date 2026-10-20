import { useEffect, useRef } from 'react';
import type { CanvasInteractionState, ActorDragState } from '@ui/canvas/canvasInteractionTypes';
import { ADD_MOVEMENT_WAYPOINT_EVENT } from './actorMovementPaths';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';

export function useActorMovementWaypoints(input: CanvasInteractionState) {
  const current = useRef(input.actorDrag); current.current = input.actorDrag;
  useEffect(() => {
    current.current = null;
    input.setActorDrag(null);
  }, [input.activeToolId, input.encounter.id]);
  useEffect(() => {
    function add() {
      if (input.encounter.movementRules.zoneLocked || current.current?.phase !== 'dragging') return;
      input.setActorDrag(drag => {
        if (!drag || drag.phase !== 'dragging') return drag;
        const next = { ...drag, waypoints: [...(drag.waypoints ?? []), drag.current] };
        current.current = next; return next;
      });
    }
    function key(event: KeyboardEvent) {
      if (!current.current || ignoreShortcut(event)) return;
      if (event.key === 'Escape') { event.preventDefault(); current.current = null; input.setActorDrag(null); }
      else if ((event.code === 'Space' || event.key === 'Shift') && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); add(); }
    }
    window.addEventListener(ADD_MOVEMENT_WAYPOINT_EVENT, add);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener(ADD_MOVEMENT_WAYPOINT_EVENT, add); window.removeEventListener('keydown', key, true); };
  }, [input.encounter.movementRules.zoneLocked, input.setActorDrag]);
  // Pointer updates replace the draft object; the frozen start identifies its gesture.
  return (drag: ActorDragState) => current.current?.start === drag.start;
}
