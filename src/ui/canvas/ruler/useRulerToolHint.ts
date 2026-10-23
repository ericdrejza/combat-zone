import { useMobileControls } from '@hooks/useMobileControls';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { selectLockedRulers, selectRulerDraft, selectRulerOptions } from '@interaction/rulerState';
import { usePersistence } from '@ui/persistence/PersistenceProvider';

/** Advertise locking gestures only when this editor can lock the current draft. */
export function useRulerToolHint(activeToolId: string): string | undefined {
  const draft = useSelector(selectRulerDraft), options = useSelector(selectRulerOptions), locked = useSelector(selectLockedRulers);
  const editing = useSelector((state: RootState) => !!state.interaction.editingRuler), { readOnly } = usePersistence();
  const touch = useMobileControls(false);
  if (activeToolId !== 'ruler') return undefined;
  if (!draft?.points.length) return locked.length ? `Click to start a measurement. Right-click${touch ? ' or touch-hold' : ''} an artifact for options.` : 'Click to start a measurement.';
  const path = options.shape === 'path';
  const backtrack = touch ? 'Tap Undo to remove the last point; hold to clear points.' : 'Right-click to pick up the last point.';
  if (draft.points.length < 2) return `${path ? 'Click to add a waypoint.' : 'Click to place the second point.'} ${backtrack} Escape cancels.`;
  const instructions = path ? 'Click to add waypoints; drag points to adjust.' : 'Drag points to adjust.';
  return `${instructions} ${backtrack}${readOnly ? '' : ' Click a placed ruler point or press Spacebar to lock the ruler in place.'}${editing ? ' Escape restores the locked version.' : ' Escape cancels.'}`;
}
