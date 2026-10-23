import { LOCK_RULER_EVENT } from '@ui/canvas/ruler/rulerEvents';
import { useNamePreview } from '@ui/controls/useNamePreview';
import { PropertiesNameInput } from '@ui/controls/PropertiesNameInput';
import { useDispatch, useSelector } from 'react-redux';
import { LockKeyhole, Trash2 } from 'lucide-react';
import { canConvertRulerShape } from '@core/measurement/rulerShapeConversion';
import { selectRulerPropertiesArtifact } from '@interaction/rulerState';
import { convertLockedRuler, deleteLockedRuler, updateLockedRuler } from '@interaction/interactionState';
import type { RootState } from '@store/store';
import { useMobileControls } from '@hooks/useMobileControls';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { PreferenceSwitch } from '@ui/settings/PreferenceSwitch';
import { SETTINGS_CONTROL } from '@ui/settings/SettingsLayout';
import { ToolbarOptionButton } from '@ui/toolbar/ToolbarOption';
import { RULER_SHAPE_OPTIONS } from '@ui/toolbar/ruler/rulerShapeOptions';
import { RulerAppearanceProperties } from './ruler_properties/RulerAppearanceProperties';

const actionClass = 'inline-flex min-h-11 min-w-0 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40';
const sectionClass = 'min-w-0 space-y-3 rounded-2xl border border-canvas-line bg-canvas-surface p-3';

/** Edits the saved ruler targeted by its context menu, or joins its current geometry draft. */
export function RulerPropertiesPanel() {
  const dispatch = useDispatch(), { readOnly } = usePersistence(), touch = useMobileControls(false);
  const ruler = useSelector(selectRulerPropertiesArtifact);
  const previewName = useNamePreview('ruler', ruler ? [ruler.id] : []);
  const editing = useSelector((state: RootState) => !!state.interaction.editingRuler);
  if (!ruler) return <p className="text-sm text-canvas-muted">Right-click{touch ? ' or touch-hold' : ''} a ruler to view its properties.</p>;
  const updateOptions = (patch: Partial<typeof ruler.options>) => dispatch(updateLockedRuler({ id: ruler.id, options: { ...ruler.options, ...patch } }));
  const blocked = ruler.options.shape === 'path' && ruler.points.length > 2;
  return <div aria-label="Ruler properties" className="min-w-0 space-y-4 text-sm">
    <section className={sectionClass}>
      <h3 className="font-semibold text-canvas-ink">Name</h3>
      <PropertiesNameInput aria-label="Ruler name" className={SETTINGS_CONTROL} disabled={readOnly} key={ruler.id} committedValue={ruler.name} onPreview={previewName}
        onCommit={name => { if (!readOnly) dispatch(updateLockedRuler({ id: ruler.id, name })); }} />
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-canvas-ink">Display</h3>
      <PreferenceSwitch compact label="Highlight actors" checked={ruler.options.highlightActors ?? ruler.options.shape !== 'path'} disabled={readOnly} onChange={highlightActors => updateOptions({ highlightActors })} />
      <PreferenceSwitch compact label="Show measurement" checked={ruler.options.showDistance !== false} disabled={readOnly} onChange={showDistance => updateOptions({ showDistance })} />
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-canvas-ink">Color</h3>
      <RulerAppearanceProperties key={`${ruler.id}:${editing}`} ruler={ruler} readOnly={readOnly} />
    </section>
    <section className={sectionClass}>
      <h3 className="font-semibold text-canvas-ink">Shape</h3>
      <div role="group" aria-label="Ruler artifact shape" className="grid grid-cols-5 gap-1">
        {RULER_SHAPE_OPTIONS.map(({ shape, label, Icon }) => <ToolbarOptionButton className="!min-w-0 w-full !px-0" key={shape} aria-label={`Convert to ${label.toLowerCase()}`} title={`Convert to ${label.toLowerCase()}`}
          aria-pressed={ruler.options.shape === shape} active={ruler.options.shape === shape} disabled={readOnly || !canConvertRulerShape(ruler, shape)}
          onClick={() => dispatch(convertLockedRuler({ id: ruler.id, shape }))}>
          <Icon size={18} className={shape === 'line' ? 'rotate-90' : undefined} aria-hidden="true" />
        </ToolbarOptionButton>)}
      </div>
      {blocked ? <p className="text-xs text-canvas-muted">A Path must have no more than two placed points to convert to an area ruler.</p> : null}
    </section>
    {editing ? <p className="text-xs text-canvas-muted">Changes join the current edit. Lock the ruler to save them; Escape on the canvas restores the saved ruler.</p> : null}
    <div className="grid grid-cols-[minmax(max-content,1fr)_minmax(0,1fr)] gap-3">
      <button aria-label="Delete ruler" title="Delete ruler" data-touch-tooltip-label="Delete ruler" disabled={readOnly} type="button"
        className={`${actionClass} border-red-200 bg-red-50 text-red-700 enabled:hover:bg-red-100 focus-visible:ring-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-500 dark:enabled:hover:bg-red-900`}
        onClick={() => dispatch(deleteLockedRuler(ruler.id))}><Trash2 size={16} className="shrink-0" aria-hidden="true" />Delete ruler</button>
      <button aria-label="Lock ruler" title="Lock ruler (Space)" data-touch-tooltip-label="Lock ruler (Space)" disabled={readOnly || !editing || ruler.points.length < 2} type="button"
        className={`${actionClass} !px-2 border-canvas-line bg-canvas-surface text-canvas-ink enabled:hover:bg-canvas enabled:hover:border-canvas-ink focus-visible:ring-canvas-ink disabled:text-canvas-muted`}
        onClick={() => window.dispatchEvent(new Event(LOCK_RULER_EVENT))}><LockKeyhole size={16} className="shrink-0" aria-hidden="true" />Lock</button>
    </div>
  </div>;
}
