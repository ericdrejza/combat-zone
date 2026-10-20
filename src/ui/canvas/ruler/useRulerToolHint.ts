import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { selectLockedRulers, selectRulerDraft, selectRulerOptions } from '@interaction/rulerState';
import { usePersistence } from '@ui/persistence/PersistenceProvider';

/** Only advertise Space when the current draft can actually be locked by this editor. */
export function useRulerToolHint(activeToolId: string): string | undefined {
  const draft = useSelector(selectRulerDraft), options = useSelector(selectRulerOptions), locked = useSelector(selectLockedRulers);
  const editing = useSelector((state: RootState) => !!state.interaction.editingRuler), { readOnly } = usePersistence();
  if (activeToolId !== 'ruler') return undefined;
  if (!draft?.points.length) return locked.length ? 'Click to start a measurement. Right-click or touch-hold an artifact for options.' : 'Click to start a measurement.';
  const path = options.shape === 'path';
  if (draft.points.length < 2) return path ? 'Click to add a waypoint. Right-click to pick up the last point; Escape cancels.' : 'Click to place the second point. Right-click to pick up the last point; Escape cancels.';
  const instructions = path ? 'Click to add waypoints; drag points to adjust.' : 'Drag points to adjust; click the second point to pick it up.';
  return `${instructions} Right-click to pick up the last point.${readOnly ? '' : ' Press Spacebar to lock measurement.'}${editing ? ' Escape restores the locked version.' : ' Escape cancels.'}`;
}
