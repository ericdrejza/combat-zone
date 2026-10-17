import { ResetSettingsButton } from "./ResetSettingsButton";
import { useResetSettingsCategory } from "./useResetSettingsCategory";
import { SelectionOutlineSettings } from "./SelectionOutlineSettings";
import { Reorder } from 'motion/react';
import { MoveUp, MoveDown, GripVertical, Lock, Magnet, VectorSquare, Blend } from 'lucide-react';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import type { MembershipDecider } from '@ui/canvas_preferences/canvasPreferenceStorage';
import { ToolbarOptionButton, ToolbarOptionGroup } from '@ui/toolbar/ToolbarOption';
import type { MovementRules } from '@core/movement/types';
import { PreferenceSwitch } from './PreferenceSwitch';
import { DefaultColorSettings } from './DefaultColorSettings';
import { BackgroundResizeSettings } from './BackgroundResizeSettings';
import { useInterfacePreferences } from '@ui/interface_preferences/InterfacePreferenceProvider';
import { SettingsCategory, SettingsSection, SettingsSubsection, SettingsField, SettingsRow, SETTINGS_CONTROL } from './SettingsLayout';


const labels: Record<MembershipDecider, string> = { cells: 'Most shared cells', nearest: 'Nearest Zone Center', current: 'Keep current Zone', ask: 'Ask Me' };
export function CanvasSettings() {
  const resetCategory = useResetSettingsCategory("canvas");
  const { preferences, save } = useCanvasPreferences();
  const { panWithRightClickDrag, setPanWithRightClickDrag, encounterCreationTool, setEncounterCreationTool } = useInterfacePreferences();
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
  return <SettingsCategory actions={<ResetSettingsButton category="Canvas" onReset={resetCategory} />} title="Canvas" description="Canvas navigation, creation defaults, and placement behavior.">
    <SettingsSection title="New encounter defaults" description="These defaults apply when creating encounters and Zones.">
      <SettingsField label="Tool auto-select upon encounter creation">
        <select aria-label="Tool auto-select upon encounter creation" className={SETTINGS_CONTROL} value={encounterCreationTool} onChange={event => setEncounterCreationTool(event.currentTarget.value as "background" | "zone")}>
          <option value="background">Background</option><option value="zone">Zone</option>
        </select>
      </SettingsField>
      <SettingsSubsection title="Placement">
        <SettingsRow label="New encounter placement defaults" fullWidth>
          <ToolbarOptionGroup aria-label="New encounter placement defaults">
            {([{ key: 'zoneLocked', label: 'Default Zone lock', Icon: Lock }, { key: 'snapToGrid', label: 'Default actor snapping', Icon: Magnet }, { key: 'snapZoneVertices', label: 'Default Zone vertex snapping', Icon: VectorSquare }, { key: 'allowOverlap', label: 'Default Overlap', Icon: Blend }] as const).map(({ key, label, Icon }) => <ToolbarOptionButton key={key} aria-label={label} active={preferences.defaults[key]} aria-pressed={preferences.defaults[key]} disabled={key === 'allowOverlap' && preferences.defaults.zoneLocked} onClick={() => toggle(key)} type="button"><Icon size={16} /></ToolbarOptionButton>)}
          </ToolbarOptionGroup>
        </SettingsRow>
      </SettingsSubsection>
      <DefaultColorSettings />
    </SettingsSection>
    <SelectionOutlineSettings />
    <SettingsSection title="Navigation">
      <PreferenceSwitch checked={panWithRightClickDrag} label="Pan with right-click drag" onChange={setPanWithRightClickDrag} />
    </SettingsSection>
    <SettingsSection title="Background"><BackgroundResizeSettings /></SettingsSection>
    <SettingsSection title="Zone membership" description="Changes apply to future membership decisions.">
      <SettingsField label="Membership test">
        <select aria-label="Zone membership test" className={SETTINGS_CONTROL} value={preferences.membership} onChange={event => save({ ...preferences, membership: event.currentTarget.value as typeof preferences.membership })}>
          <option value="center">Actor center</option><option value="cells">Anchor-cell centers</option><option value="overlap">Any token overlap</option>
        </select>
      </SettingsField>
      {preferences.membership === 'cells' ? <SettingsField label="When actor snapping is off"><select aria-label="Unsnapped membership fallback" className={SETTINGS_CONTROL} value={preferences.fallback} onChange={event => save({ ...preferences, fallback: event.currentTarget.value as typeof preferences.fallback })}><option value="center">Actor center</option><option value="overlap">Any token overlap</option></select></SettingsField> : null}
      <SettingsSubsection title="Decision priority" description="Drag deciders into priority order. Ties continue to the next decider.">
        <Reorder.Group axis="y" values={preferences.deciders} onReorder={deciders => save({ ...preferences, deciders })} className="space-y-2" aria-label="Membership decision priority">
          {preferences.deciders.map((decider, index) => <Reorder.Item key={decider} value={decider} className="flex items-center gap-2 rounded-lg border border-canvas-line bg-canvas-surface p-2 hover:border-canvas-ink">
            <GripVertical size={16} aria-hidden="true" /><span className="min-w-0 flex-1 text-sm">{labels[decider]}</span>
            <ToolbarOptionButton aria-label={`Prioritize ${labels[decider]}`} disabled={index === 0} onClick={() => move(index, -1)} type="button"><MoveUp aria-hidden="true" size={14} /></ToolbarOptionButton>
            <ToolbarOptionButton aria-label={`Deprioritize ${labels[decider]}`} disabled={index === preferences.deciders.length - 1} onClick={() => move(index, 1)} type="button"><MoveDown aria-hidden="true" size={14} /></ToolbarOptionButton>
          </Reorder.Item>)}
        </Reorder.Group>
      </SettingsSubsection>
    </SettingsSection>
    <SettingsSection title="Cell Tracer"><SettingsField label="Invalid routes"><select aria-label="Cell Tracer invalid route" className={SETTINGS_CONTROL} value={preferences.tracerInvalidRoute} onChange={event => save({ ...preferences, tracerInvalidRoute: event.currentTarget.value as typeof preferences.tracerInvalidRoute })}><option value="reject">Reject invalid route</option><option value="detour">Find shortest valid detour</option></select></SettingsField></SettingsSection>
    <SettingsSection title="Isometric tokens">
      <PreferenceSwitch label="Project tokens on isometric grids" description="Project token artwork and outlines onto isometric grids. Names stay upright; placement and collision footprints stay unchanged." checked={preferences.projectIsometricTokens} onChange={projectIsometricTokens => save({ ...preferences, projectIsometricTokens })} />
    </SettingsSection>
  </SettingsCategory>;
}
