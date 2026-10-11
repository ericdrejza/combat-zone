import { useGridAppearanceDraft } from './useGridAppearanceDraft';
import { useEffect, useRef, useState } from 'react';
import { useSelector, useStore } from 'react-redux';
import type { RootState } from '@store/store';
import type { GridConfiguration } from '@core/movement/types';
import { updateGridConfiguration } from '@core/movement/updateGridConfiguration';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { readBackgroundResizeOverflowPreference } from '@ui/interface_preferences/InterfacePreferenceProvider';

const control = 'min-h-11 w-full rounded-lg border border-canvas-line bg-canvas-surface p-2 enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50';
/** Geometry commits immediately; appearance commits once when its control loses focus. */
export function GridPropertiesPanel() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const aligning = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  const { readOnly } = usePersistence(), commit = useKeyboardEncounterCommit();
  const store = useStore<RootState>(), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const queue = useRef(Promise.resolve()), colorPickerOpen = useRef(false), [error, setError] = useState('');
  function update(patch: Partial<GridConfiguration>): Promise<void> {
    if (readOnly || aligning) return Promise.resolve();
    const encounterId = encounter.id;
    const appearanceOnly = patch.type === undefined;
    const isCurrent = () => store.getState().encounter.present.id === encounterId && !store.getState().interaction.gridCalibrationActive &&
      (appearanceOnly || (mounted.current && store.getState().interaction.activeToolId === 'grid'));
    queue.current = queue.current.then(async () => {
      if (!isCurrent()) return;
      if (Object.entries(patch).every(([key, value]) => store.getState().encounter.present.grid[key as keyof GridConfiguration] === value)) return;
      if (mounted.current) setError('');
      const applied = await commit('grid.update', {}, state => {
        const geometryChanged = patch.type !== undefined && patch.type !== state.grid.type;
        return geometryChanged ? updateGridConfiguration(state, { ...state.grid, ...patch }, readBackgroundResizeOverflowPreference()) : { ...state, grid: { ...state.grid, ...patch } };
      }, isCurrent);
      if (!applied && mounted.current) setError('Grid changes could not be applied. Check validation messages.');
    }).catch(() => { if (mounted.current) setError('Grid changes could not be applied.'); });
    return queue.current;
  }
  const appearance = useGridAppearanceDraft(encounter.grid, encounter.id, readOnly || aligning, update);
  return <section aria-label="Grid properties" className="space-y-4">
    <h3 className="font-display text-lg font-semibold">Grid properties</h3>
    <fieldset disabled={readOnly || aligning} className="space-y-4 disabled:opacity-50">
      <label className="block space-y-1 text-sm">Grid type<select aria-label="Grid type" className={control} value={encounter.grid.type} onChange={event => update({ type: event.currentTarget.value as GridConfiguration['type'] })}>
        <option value="square">Square</option><option value="hex-flat">Hex — flat top</option><option value="hex-pointy">Hex — pointy top</option>
      </select></label>
      <label className="block space-y-1 text-sm">Line color<input aria-label="Grid line color" className={control} type="color" value={appearance.color}
        onChange={event => appearance.preview({ color: event.currentTarget.value })}
        onClick={event => {
          if (colorPickerOpen.current) { event.preventDefault(); event.currentTarget.blur(); }
          else colorPickerOpen.current = true;
        }}
        onBlur={() => { colorPickerOpen.current = false; appearance.finish('color'); }} /></label>
      <label className="block space-y-2 text-sm"><span className="flex justify-between">Line opacity<span>{Math.round(appearance.opacity * 100)}%</span></span>
        <input aria-label="Line opacity" className="w-full accent-canvas-ink" type="range" min="0" max="1" step="0.05" value={appearance.opacity} onChange={event => appearance.preview({ opacity: Number(event.currentTarget.value) })} onBlur={() => appearance.finish('opacity')} />
      </label>
    </fieldset>
    {aligning ? <p className="text-sm text-canvas-muted">Finish or cancel alignment to edit grid properties.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
  </section>;
}
