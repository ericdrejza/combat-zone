import { useNamePreview } from '@ui/controls/useNamePreview';
import type { ColorOpacity } from "@ui/controls/ColorOpacityFields";
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Pencil, Trash2, Type, Palette, X, RulerDimensionLine, Lightbulb } from 'lucide-react';
import type { LockedRuler } from '@core/measurement/types';
import { editLockedRuler, deleteLockedRuler, setActiveTool, updateLockedRuler } from '@interaction/interactionState';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { RenameModal } from '@ui/RenameModal';
import { RulerColorDialog } from './RulerColorDialog';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';

export function RulerContextWheel({ ruler, x, y, onClose, onAppearancePreview }: { ruler: LockedRuler; x: number; y: number; onClose: () => void; onAppearancePreview?: (value: ColorOpacity) => void }) {
  const previewName = useNamePreview('ruler', [ruler.id]);
  const { readOnly } = usePersistence();
  const dispatch = useDispatch(), ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'wheel' | 'name' | 'color'>('wheel');
  const { preferences } = useCanvasPreferences();
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (mode === 'wheel' && !ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => {
      if (mode !== 'wheel') return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (mode === 'wheel' && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Tab'].includes(event.key)) {
        event.preventDefault(); const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement), step = event.shiftKey || ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener('pointerdown', outside); window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key, true); };
  }, [mode, onClose]);
  if (mode === 'name') return createPortal(<RenameModal ariaLabel="Name ruler" title="Name ruler" inputLabel="Ruler name" initialName={ruler.name} onPreview={previewName} onClose={onClose}
    onRename={name => dispatch(updateLockedRuler({ id: ruler.id, name }))} />, document.body);
  if (mode === 'color') return createPortal(<RulerColorDialog ruler={ruler} inherited={{ color: preferences.rulerColor, opacity: preferences.rulerOpacity }} readOnly={readOnly} onPreview={onAppearancePreview}
    onSave={patch => dispatch(updateLockedRuler({ id: ruler.id, ...patch }))} onClose={onClose} />, document.body);
  const showDistance = ruler.options.showDistance !== false;
  const highlightActors = ruler.options.highlightActors ?? ruler.options.shape !== 'path';
  // SVG/screen angles increase clockwise, so the glow action follows distance around the ring.
  const actions = [
    { label: 'Edit ruler', Icon: Pencil, run: () => { dispatch(setActiveTool('ruler')); dispatch(editLockedRuler(ruler.id)); onClose(); } },
    { label: 'Delete ruler', Icon: Trash2, run: () => { dispatch(deleteLockedRuler(ruler.id)); onClose(); } },
    { label: 'Name ruler', Icon: Type, run: () => setMode('name') },
    { label: 'Show measurement', Icon: RulerDimensionLine, checked: showDistance,
      run: () => dispatch(updateLockedRuler({ id: ruler.id, options: { ...ruler.options, showDistance: !showDistance } })) },
    { label: 'Highlight overlapping actors', Icon: Lightbulb, checked: highlightActors,
      run: () => dispatch(updateLockedRuler({ id: ruler.id, options: { ...ruler.options, highlightActors: !highlightActors } })) },
    { label: 'Choose ruler color', Icon: Palette, run: () => setMode('color') }
  ];
  return createPortal(<div ref={ref} role="menu" aria-label="Ruler options" className="fixed z-[110] h-48 w-48 rounded-full border border-canvas-line bg-canvas-panel/95 text-canvas-ink shadow-xl"
    style={{ left: Math.max(8, Math.min(window.innerWidth - 200, x - 96)), top: Math.max(8, Math.min(window.innerHeight - 200, y - 96)) }}>
    {actions.map(({ label, Icon, checked, run }, index) => {
      const angle = (-90 + index * 60) * Math.PI / 180;
      return <div key={label} className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${50 + 34 * Math.cos(angle)}%`, top: `${50 + 34 * Math.sin(angle)}%` }}>
        <ToolbarOptionButton disabled={readOnly} aria-label={label} role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={checked} active={checked} title={label} onClick={run}><Icon size={19} aria-hidden="true" /></ToolbarOptionButton>
      </div>;
    })}
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"><ToolbarOptionButton aria-label="Close ruler options" role="menuitem" onClick={onClose}><X size={18} aria-hidden="true" /></ToolbarOptionButton></div>
  </div>, document.body);
}
