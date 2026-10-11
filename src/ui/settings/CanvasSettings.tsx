import { Reorder } from 'motion/react';
import { ArrowLeft, ArrowRight, GripVertical, Lock, Magnet, VectorSquare, Blend } from 'lucide-react';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import type { MembershipDecider } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { ToolbarOptionButton, ToolbarOptionGroup } from '@ui/toolbar/ToolbarOption';
import type { MovementRules } from '@core/movement/types';
import { PreferenceSwitch } from './PreferenceSwitch';
import { DefaultColorSettings } from './DefaultColorSettings';

const control = 'min-h-11 w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink';
const labels: Record<MembershipDecider, string> = { cells: 'Most shared cells', nearest: 'Nearest Zone Center', current: 'Keep current Zone', ask: 'Ask Me' };
export function CanvasSettings() {
  const { preferences, save } = useCanvasPreferences();
  function toggle(key: keyof MovementRules) {
    const defaults = { ...preferences.defaults, [key]: !preferences.defaults[key] };
    if (defaults.zoneLocked) defaults.allowOverlap = false;
    if (!defaults.snapToGrid) defaults.trimTokens = false;
    save({ ...preferences, defaults });
  }
  function move(index: number, offset: number) {
    const order = [...preferences.deciders], target = index + offset;
    [order[index], order[target]] = [order[target], order[index]];
    save({ ...preferences, deciders: order });
  }
  return <section className="space-y-6 p-5" aria-labelledby="canvas-settings-heading">
    <div><h3 id="canvas-settings-heading" className="font-display text-lg font-semibold">Canvas</h3><p className="mt-1 text-sm text-canvas-muted">Defaults and behavior for the encounter canvas.</p></div>
    <div className="space-y-3"><h4 className="font-semibold">Defaults</h4>
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm">New encounters</span><ToolbarOptionGroup aria-label="New encounter placement defaults">
        {([{ key: 'zoneLocked', label: 'Default Zone lock', Icon: Lock }, { key: 'snapToGrid', label: 'Default actor snapping', Icon: Magnet }, { key: 'snapZoneVertices', label: 'Default Zone vertex snapping', Icon: VectorSquare }, { key: 'allowOverlap', label: 'Default Overlap', Icon: Blend }] as const).map(({ key, label, Icon }) => <ToolbarOptionButton key={key} aria-label={label} active={preferences.defaults[key]} aria-pressed={preferences.defaults[key]} disabled={key === 'allowOverlap' && preferences.defaults.zoneLocked} onClick={() => toggle(key)} type="button"><Icon size={16} /></ToolbarOptionButton>)}
      </ToolbarOptionGroup></div>
      <DefaultColorSettings />
    </div>
    <div className="space-y-3 border-t border-canvas-line pt-5"><h4 className="text-sm font-semibold">Zone membership</h4>
      <label className="block space-y-1 text-sm">Membership test<select aria-label="Zone membership test" className={control} value={preferences.membership} onChange={event => save({ ...preferences, membership: event.currentTarget.value as typeof preferences.membership })}>
        <option value="center">Actor center</option><option value="cells">Anchor-cell centers</option><option value="overlap">Any token overlap</option>
      </select></label>
      {preferences.membership === 'cells' ? <label className="block space-y-1 text-sm">When actor snapping is off<select aria-label="Unsnapped membership fallback" className={control} value={preferences.fallback} onChange={event => save({ ...preferences, fallback: event.currentTarget.value as typeof preferences.fallback })}><option value="center">Actor center</option><option value="overlap">Any token overlap</option></select></label> : null}
      <p className="text-sm text-canvas-muted">Drag deciders into priority order. Ties continue to the next decider.</p>
      <Reorder.Group axis="y" values={preferences.deciders} onReorder={deciders => save({ ...preferences, deciders })} className="space-y-2" aria-label="Membership decision priority">
        {preferences.deciders.map((decider, index) => <Reorder.Item key={decider} value={decider} className="flex items-center gap-2 rounded-lg border border-canvas-line bg-canvas-surface p-2 hover:border-canvas-ink">
          <GripVertical size={16} aria-hidden="true" /><span className="min-w-0 flex-1 text-sm">{labels[decider]}</span>
          <ToolbarOptionButton aria-label={`Move ${labels[decider]} earlier`} disabled={index === 0} onClick={() => move(index, -1)} type="button"><ArrowLeft size={14} /></ToolbarOptionButton>
          <ToolbarOptionButton aria-label={`Move ${labels[decider]} later`} disabled={index === preferences.deciders.length - 1} onClick={() => move(index, 1)} type="button"><ArrowRight size={14} /></ToolbarOptionButton>
        </Reorder.Item>)}
      </Reorder.Group>
      <p className="text-xs text-canvas-muted">Changes apply to future membership decisions.</p>
    </div>
    <div className="space-y-3 border-t border-canvas-line pt-5"><h4 className="text-sm font-semibold">Cell Tracer</h4><label className="block space-y-1 text-sm">Invalid routes<select aria-label="Cell Tracer invalid route" className={control} value={preferences.tracerInvalidRoute} onChange={event => save({ ...preferences, tracerInvalidRoute: event.currentTarget.value as typeof preferences.tracerInvalidRoute })}><option value="reject">Reject invalid route</option><option value="detour">Find shortest valid detour</option></select></label></div>
    <div className="space-y-2 border-t border-canvas-line pt-5"><h4 className="text-sm font-semibold">Isometric tokens</h4>
      <PreferenceSwitch ariaLabel="Project tokens on isometric grids" label="Project tokens on isometric grids" checked={preferences.projectIsometricTokens} onChange={projectIsometricTokens => save({ ...preferences, projectIsometricTokens })} />
      <p className="text-xs text-canvas-muted">Project canvas token artwork and outlines onto the isometric grid. Names stay upright; placement and collision footprints stay unchanged.</p>
    </div>
  </section>;
}
