import { useMobileControls } from '@hooks/useMobileControls';
import { RulerRemovePointButton } from './RulerRemovePointButton';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { LockKeyhole } from 'lucide-react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { selectRulerDraft } from '@interaction/rulerState';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import { LOCK_RULER_EVENT } from './rulerEvents';

/** Shares the contextual canvas action area; keyboard users can also press Space. */
export function RulerLockButton() {
  const { readOnly } = usePersistence();
  const active = useSelector((state: RootState) => state.interaction.activeToolId === 'ruler');
  const draft = useSelector(selectRulerDraft);
  const touch = useMobileControls(false);
  if (!active || !draft) return null;
  return <div className="flex flex-wrap items-center gap-1">
    {touch && draft?.points.length ? <RulerRemovePointButton /> : null}
    {draft && draft.points.length >= 2 ? <ToolbarOptionButton disabled={readOnly} aria-label="Lock ruler" title="Lock ruler (Space)" onClick={() => window.dispatchEvent(new Event(LOCK_RULER_EVENT))}>
    <LockKeyhole size={18} aria-hidden="true" />
  </ToolbarOptionButton> : null}
  </div>;
}
