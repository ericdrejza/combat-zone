import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import type { EncounterState } from '@core/encounter/types';
import type { GridConfiguration } from '@core/movement/types';
import { validGrid } from '@core/movement/types';
import { setGridPreview } from '@interaction/interactionState';
import type { RootState } from '@store/store';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { GridSettingsFields, gridSettingsButton } from './GridSettingsFields';

const button = gridSettingsButton;
export function GridSettingsDialog({ encounter, busy, onApply, onClose }: {
  encounter: EncounterState; busy: boolean; onApply: (grid: GridConfiguration) => Promise<boolean>; onClose: () => void;
}) {
  const opener = useRef(document.activeElement as HTMLElement | null);
  const form = useRef<HTMLFormElement>(null);
  const snapshot = useRef(encounter);
  const close = useRef(onClose); close.current = onClose;
  const [draft, setDraft] = useState(encounter.grid);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const current = useSelector((state: RootState) => state.encounter.present);
  const { readOnly } = usePersistence();
  useEffect(() => { if (current !== snapshot.current || readOnly) close.current(); }, [current, readOnly]);
  useEffect(() => { if (validGrid(draft)) dispatch(setGridPreview(draft)); }, [draft, dispatch]);
  useEffect(() => {
    const previousFocus = opener.current;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const controls = [...(form.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', listener);
    return () => { dispatch(setGridPreview(null)); window.removeEventListener('keydown', listener); previousFocus?.focus(); };
  }, [dispatch]);
  return createPortal(<div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-end p-3" role="presentation">
    <form ref={form} data-grid-settings-dialog aria-label="Grid settings" aria-modal="true" role="dialog" className="pointer-events-auto max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-canvas-line bg-canvas-panel p-4 text-canvas-ink shadow-xl"
      onSubmit={async event => { event.preventDefault(); if (!validGrid(draft)) { setError('Enter a positive cell size and finite coordinates.'); return; } if (await onApply(draft)) onClose(); else setError('Grid changes could not be applied. Check canvas fit and validation messages.'); }}>
      <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Grid settings</h2><button autoFocus aria-label="Close grid settings" type="button" className={button} onClick={onClose}><X size={18} /></button></div>
      <GridSettingsFields draft={draft} setDraft={setDraft} />
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2"><button className={button} type="button" onClick={onClose}>Cancel</button><button className={button} type="submit" disabled={readOnly || busy || !validGrid(draft)}>{busy ? 'Applying…' : 'Apply'}</button></div>
    </form>
  </div>, document.body);
}
