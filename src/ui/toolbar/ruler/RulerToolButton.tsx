import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { ConeAngleField } from './ConeAngleField';
import { Eraser, Footprints, Waypoints, Radius, Cone, RectangleHorizontal, RectangleEllipsis } from 'lucide-react';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { selectRulerOptions, selectLockedRulers } from '@interaction/rulerState';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { TOOL_DEFINITIONS_BY_ID, type ToolId } from '@interaction/tools/toolRegistry';
import { clearRulers, setRulerOptions } from '@interaction/interactionState';
import type { RootState } from '@store/store';
import { isSquareTopology } from '@core/movement/gridProjection';
import { ToolButton } from '@ui/toolbar/ToolButton';
import { ToolbarOptionButton, ToolbarOptionRow, ToolbarSubtoolBar, ToolbarOptionGroup, ToolbarOptionKeybind } from '@ui/toolbar/ToolbarOption';
import { RulerDimensions } from './RulerDimensions';

const control = 'rounded-lg border border-canvas-line bg-canvas-surface px-2 text-sm text-canvas-ink enabled:hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-50';
export function RulerToolButton({ activeToolId, compactLayout, compactSubtoolHost }: {
  activeToolId: ToolId | null; compactLayout: boolean; compactSubtoolHost: HTMLDivElement | null;
}) {
  const dispatch = useDispatch();
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const options = useSelector(selectRulerOptions);
  const locked = useSelector(selectLockedRulers), draft = useSelector((state: RootState) => state.interaction.rulerDraft);
  const hasRulers = !!draft || locked.length > 0, { readOnly } = usePersistence();
  const { preferences, save } = useCanvasPreferences();
  const square = isSquareTopology(encounter.grid.type);
  const controls = activeToolId === 'ruler' ? <ToolbarSubtoolBar aria-label="Ruler options">
    <ToolbarOptionGroup role="group" aria-label="Ruler shape">
      {([{ shape: 'path', label: 'Path ruler', Icon: Waypoints }, { shape: 'circle', label: 'Circle ruler', Icon: Radius },
        { shape: 'cone', label: 'Cone ruler', Icon: Cone }, { shape: 'rectangle', label: 'Rectangle ruler', Icon: RectangleHorizontal },
        { shape: 'line', label: 'Line ruler', Icon: RectangleEllipsis }] as const).map(({ shape, label, Icon }, index) =>
        <ToolbarOptionButton key={shape} aria-label={label} title={`${label} (${index + 1})`} aria-pressed={options.shape === shape} active={options.shape === shape}
          onClick={() => dispatch(setRulerOptions({ shape }))}><Icon size={18} className={shape === 'line' ? 'rotate-90' : undefined} aria-hidden="true" /><ToolbarOptionKeybind active={options.shape === shape}>{index + 1}</ToolbarOptionKeybind></ToolbarOptionButton>)}
    </ToolbarOptionGroup>
    {options.shape === 'cone' ? <ConeAngleField className={control} value={options.angle ?? (square ? 90 : 60)} onChange={angle => dispatch(setRulerOptions({ angle }))} /> : null}
    <RulerDimensions className={`${control} min-h-11`} />
    <ToolbarOptionButton aria-label="Show actor movement distance" title="Show actor movement distance (9)" aria-pressed={preferences.showActorMovementDistance} active={preferences.showActorMovementDistance}
      onClick={() => save({ ...preferences, showActorMovementDistance: !preferences.showActorMovementDistance })}><Footprints size={18} aria-hidden="true" /><ToolbarOptionKeybind active={preferences.showActorMovementDistance}>9</ToolbarOptionKeybind></ToolbarOptionButton>
    <ToolbarOptionButton aria-label="Clear ruler measurements" title="Clear ruler measurements (0)" disabled={!hasRulers || readOnly && locked.length > 0} onClick={() => dispatch(clearRulers())}><Eraser size={18} aria-hidden="true" /><ToolbarOptionKeybind>0</ToolbarOptionKeybind></ToolbarOptionButton>
  </ToolbarSubtoolBar> : null;
  return <><ToolbarOptionRow className="max-lg:contents"><ToolButton activeToolId={activeToolId} tool={TOOL_DEFINITIONS_BY_ID.ruler} />{!compactLayout ? controls : null}</ToolbarOptionRow>
    {compactLayout && compactSubtoolHost && controls ? createPortal(controls, compactSubtoolHost) : null}</>;
}
