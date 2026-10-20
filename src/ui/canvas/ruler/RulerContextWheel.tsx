import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Pencil, Trash2, Type, Palette, X } from 'lucide-react';
import type { LockedRuler } from '@core/measurement/types';
import { editLockedRuler, deleteLockedRuler, setActiveTool, updateLockedRuler } from '@interaction/interactionState';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { RenameModal } from '@ui/RenameModal';
import { RulerColorDialog } from './RulerColorDialog';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';

export function RulerContextWheel({ ruler, x, y, onClose }: { ruler: LockedRuler; x: number; y: number; onClose: () => void }) {
  const { readOnly } = usePersistence();
  const dispatch = useDispatch(), ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'wheel' | 'name' | 'color'>('wheel');
  const { preferences } = useCanvasPreferences();
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (mode === 'wheel' && !ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => {
      if (mode !== 'wheel') return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (mode === 'wheel' && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Tab'].includes(event.key)) {
        event.preventDefault(); const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement), step = event.shiftKey || ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener('pointerdown', outside); window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key, true); };
  }, [mode, onClose]);
  if (mode === 'name') return createPortal(<RenameModal ariaLabel="Name ruler" title="Name ruler" inputLabel="Ruler name" initialName={ruler.name} onClose={onClose}
    onRename={name => dispatch(updateLockedRuler({ id: ruler.id, name }))} />, document.body);
  if (mode === 'color') return createPortal(<RulerColorDialog ruler={ruler} inherited={{ color: preferences.rulerColor, opacity: preferences.rulerOpacity }} readOnly={readOnly}
    onSave={patch => dispatch(updateLockedRuler({ id: ruler.id, ...patch }))} onClose={onClose} />, document.body);
  const actions = [
    { label: 'Edit ruler', Icon: Pencil, row: 1, column: 2, run: () => { dispatch(setActiveTool('ruler')); dispatch(editLockedRuler(ruler.id)); onClose(); } },
    { label: 'Delete ruler', Icon: Trash2, row: 2, column: 3, run: () => { dispatch(deleteLockedRuler(ruler.id)); onClose(); } },
    { label: 'Name ruler', Icon: Type, row: 3, column: 2, run: () => setMode('name') },
    { label: 'Choose ruler color', Icon: Palette, row: 2, column: 1, run: () => setMode('color') }
  ];
  return createPortal(<div ref={ref} role="menu" aria-label="Ruler options" className="fixed z-[110] grid h-44 w-44 grid-cols-3 grid-rows-3 place-items-center rounded-full border border-canvas-line bg-canvas-panel/95 p-2 text-canvas-ink shadow-xl"
    style={{ left: Math.max(8, Math.min(window.innerWidth - 184, x - 88)), top: Math.max(8, Math.min(window.innerHeight - 184, y - 88)) }}>
    {actions.map(({ label, Icon, row, column, run }) => <div key={label} style={{ gridRow: row, gridColumn: column }}><ToolbarOptionButton disabled={readOnly} aria-label={label} role="menuitem" title={label} onClick={run}><Icon size={19} aria-hidden="true" /></ToolbarOptionButton></div>)}
    <div className="col-start-2 row-start-2"><ToolbarOptionButton aria-label="Close ruler options" role="menuitem" onClick={onClose}><X size={18} aria-hidden="true" /></ToolbarOptionButton></div>
  </div>, document.body);
}
