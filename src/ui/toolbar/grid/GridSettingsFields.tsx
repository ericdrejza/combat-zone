import type { GridConfiguration } from '@core/movement/types';
import { normalizeGridRotation } from '@core/movement/gridRotation';
import { PreferenceSwitch } from '@ui/settings/PreferenceSwitch';
import { GridNumberField } from './GridNumberField';

const control = 'min-h-11 w-full rounded-lg border border-canvas-line bg-canvas-surface p-2 text-canvas-ink hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50';
export const gridSettingsButton = 'min-h-11 rounded-full border border-canvas-line px-4 hover:bg-canvas-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';

/** The Properties panel and Background dialog edit exactly the same grid configuration. */
export function GridSettingsFields({ draft, setDraft, compact = false }: {
  draft: GridConfiguration; setDraft: (grid: GridConfiguration) => void; compact?: boolean;
}) {
  const button = gridSettingsButton;
  return <div className="space-y-4">
      <label className="block space-y-1 text-sm">Grid type<select aria-label="Grid type" className={control} value={draft.type} onChange={e => setDraft({ ...draft, type: e.currentTarget.value as GridConfiguration['type'] })}>
        <option value="square">Square</option><option value="hex-flat">Hex — flat top</option><option value="hex-pointy">Hex — pointy top</option>
      </select></label>
      {draft.warp ? <div className="space-y-2 text-sm"><p>Warped alignment is active.</p><button className={button} type="button" onClick={() => { const { warp: _warp, ...regular } = draft; setDraft(regular); }}>Use standard alignment</button></div> : null}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
  </div>;
}
