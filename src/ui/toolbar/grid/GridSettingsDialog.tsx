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
import { PreferenceSwitch } from '@ui/settings/PreferenceSwitch';
import { normalizeGridRotation } from '@core/movement/gridRotation';
import { GridNumberField } from './GridNumberField';

const control = 'min-h-11 w-full rounded-lg border border-canvas-line bg-canvas-surface p-2 text-canvas-ink hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50';
const button = 'min-h-11 rounded-full border border-canvas-line px-4 hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';
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
      <label className="block space-y-1 text-sm">Grid type<select aria-label="Grid type" className={control} value={draft.type} onChange={e => setDraft({ ...draft, type: e.currentTarget.value as GridConfiguration['type'] })}>
        <option value="square">Square</option><option value="hex-pointy">Hex — pointy top</option><option value="hex-flat">Hex — flat top</option>
      </select></label>
      {draft.warp ? <div className="space-y-2 text-sm"><p>Warped alignment is active.</p><button className={button} type="button" onClick={() => { const { warp: _warp, ...regular } = draft; setDraft(regular); }}>Use standard alignment</button></div> : null}
      <div className="grid grid-cols-2 gap-3">
        <GridNumberField label="Cell size" value={draft.cellSize} positive onChange={cellSize => setDraft({ ...draft, cellSize })} />
        <GridNumberField label="Rotation (degrees)" value={normalizeGridRotation(draft.rotation, draft.type)} onChange={rotation => setDraft({ ...draft, rotation: Number.isFinite(rotation) ? normalizeGridRotation(rotation, draft.type) : rotation })} />
        <GridNumberField label="Origin X" value={draft.origin.x} onChange={x => setDraft({ ...draft, origin: { ...draft.origin, x } })} />
        <GridNumberField label="Origin Y" value={draft.origin.y} onChange={y => setDraft({ ...draft, origin: { ...draft.origin, y } })} />
        <label className="space-y-1 text-sm">Line color<input aria-label="Grid line color" className={control} type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.currentTarget.value })} /></label>
        <label className="space-y-2 text-sm"><span className="flex justify-between">Line opacity<span className="font-mono text-canvas-muted">{Math.round(draft.opacity * 100)}%</span></span>
          <input aria-label="Line opacity" className="w-full accent-canvas-ink" type="range" min="0" max="1" step="0.05" value={draft.opacity} onChange={event => setDraft({ ...draft, opacity: Number(event.currentTarget.value) })} />
        </label>
      </div>
      <PreferenceSwitch ariaLabel="Grid visible" label="Show grid lines" checked={draft.visible} onChange={visible => setDraft({ ...draft, visible })} />
      <p className="text-xs text-canvas-muted">Cell size is measured in canvas units, across opposite sides for hexes. Grid movement snaps even when lines are hidden.</p>
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2"><button className={button} type="button" onClick={onClose}>Cancel</button><button className={button} type="submit" disabled={readOnly || busy || !validGrid(draft)}>{busy ? 'Applying…' : 'Apply'}</button></div>
    </form>
  </div>, document.body);
}
