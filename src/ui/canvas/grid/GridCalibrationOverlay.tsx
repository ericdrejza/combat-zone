import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@store/store';
import { cancelGridEditing, setGridCalibrationMode, setGridCalibrationType, setGridPreview } from '@interaction/interactionState';
import { calibrateGrid, calibrateQuadrants } from '@core/movement/gridCalibration';
import { resnapSpatialActors } from '@core/movement/movementStrategies';
import { useKeyboardEncounterCommit } from '../useKeyboardEncounterCommit';
import { AlignmentPanel, AlignmentToggle, alignmentButton } from './AlignmentPanel';
import { GridDetectionButton } from './GridDetectionButton';
import type { GridConfiguration } from '@core/movement/types';
import { usePersistence } from '@ui/persistence/PersistenceProvider';

const button = alignmentButton;
export function GridCalibrationOverlay() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const points = useSelector((state: RootState) => state.interaction.gridCalibrationPoints);
  const mode = useSelector((state: RootState) => state.interaction.gridCalibrationMode);
  const type = useSelector((state: RootState) => state.interaction.gridCalibrationType);
  const base = useMemo(() => ({ ...encounter.grid, type }), [encounter.grid, type]);
  const cellPoints = type === 'square' ? 4 : 3;
  const dispatch = useDispatch();
  const commit = useKeyboardEncounterCommit();
  const { readOnly } = usePersistence();
  const snapshot = useRef(encounter);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState<'standard' | 'warped' | null>(null);
  const [detected, setDetected] = useState<GridConfiguration | null>(null);
  const quadrants = useMemo(() => mode === 'quadrants' ? calibrateQuadrants(base, points, encounter.canvasSize) : null, [mode, encounter, base, points]);
  const needsChoice = !!quadrants?.warped && quadrants.distortion > Math.max(1, quadrants.standard.cellSize * 0.03);
  const calibrated = useMemo(() => detected ?? (mode === 'simple' ? calibrateGrid(base, points) : mode === 'quadrants' ? choice === 'warped' ? quadrants?.warped : quadrants?.standard : null) ?? null, [detected, mode, base, points, choice, quadrants]);
  useEffect(() => { if (points.length) setDetected(null); if (points.length !== cellPoints * 4) setChoice(null); }, [points, cellPoints]);
  useEffect(() => { dispatch(setGridPreview(mode === 'quadrants' || detected ? calibrated : null)); }, [dispatch, mode, detected, calibrated]);
  const reset = (nextMode = mode) => { dispatch(setGridCalibrationMode(nextMode)); setDetected(null); setChoice(null); setError(''); };
  const total = mode === 'detect' ? 0 : cellPoints * (mode === 'simple' ? 1 : 4);
  const quadrant = ['top left', 'top right', 'bottom right', 'bottom left'][Math.min(3, Math.floor(points.length / cellPoints))];
  useEffect(() => {
    if (readOnly || encounter !== snapshot.current) dispatch(cancelGridEditing());
  }, [dispatch, readOnly, encounter]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); dispatch(cancelGridEditing()); } };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [dispatch]);
  return <AlignmentPanel>
    <div role="group" aria-label="Alignment grid type" className="flex flex-wrap gap-2">
      {([['square', 'Square'], ['hex-pointy', 'Hex pointy'], ['hex-flat', 'Hex flat']] as const).map(([value, label]) =>
        <AlignmentToggle key={value} active={type === value} onClick={() => { dispatch(setGridCalibrationType(value)); setDetected(null); setChoice(null); setError(''); }}>{label}</AlignmentToggle>)}
    </div>
    <div role="group" aria-label="Alignment strategy" className="flex flex-wrap items-start gap-2">
      <AlignmentToggle active={mode === 'simple'} onClick={() => reset('simple')}>Simple alignment</AlignmentToggle>
      <AlignmentToggle active={mode === 'quadrants'} onClick={() => reset('quadrants')}>Four-quadrant alignment</AlignmentToggle>
      <GridDetectionButton encounter={encounter} grid={base} active={mode === 'detect'} disabled={readOnly || busy}
        onStart={() => reset('detect')} onDetected={setDetected} />
    </div>
    {mode === 'detect' ? <p className="text-xs text-canvas-muted">Detect the selected grid type from the background, then review and apply the preview.</p>
      : <p className="text-sm">{type === 'square' ? 'Click all four vertices around one square' : 'Click three consecutive vertices around one hexagon'}{mode === 'quadrants' && points.length < total ? ` in the ${quadrant} quadrant` : ''}. ({points.length}/{total})</p>}
    {mode === 'quadrants' ? <p className="text-xs text-canvas-muted">Use one cell in each quadrant, in the shown order. {total} vertices can fit a standard grid or a warped grid.</p> : null}
    {mode !== 'detect' ? <p className="text-xs text-canvas-muted">Right-click to remove the last point. Move these instructions using the handle.</p> : null}
    {needsChoice ? <fieldset className="space-y-2 rounded-lg border border-canvas-line p-2"><legend className="text-sm">The image grid appears distorted. Keep it standard or warp it?</legend>
      <div className="flex flex-wrap gap-2"><AlignmentToggle active={choice === 'standard'} onClick={() => setChoice('standard')}>Keep standard grid</AlignmentToggle>
        <AlignmentToggle active={choice === 'warped'} onClick={() => setChoice('warped')}>Warp to image</AlignmentToggle></div>
      <p className="text-xs text-canvas-muted">Warping also changes cell snapping, movement, and token scale. Choose either option to preview it.</p>
    </fieldset> : null}
    {quadrants && !quadrants.warped ? <p className="text-xs text-canvas-muted">These samples cannot produce a safe warped grid across the canvas. You can apply the regular fit or reset the samples.</p> : null}
    {mode !== 'detect' && points.length === total && !calibrated ? <p role="alert" className="text-sm text-red-600">These points cannot define a regular grid. Reset and choose distinct, non-collinear points.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={button} onClick={() => dispatch(cancelGridEditing())}>Cancel</button>
      <button type="button" className={button} onClick={() => reset()}>Reset points</button>
      <button type="button" className={`${button} ml-auto`} disabled={!calibrated || (needsChoice && !choice) || readOnly || busy} onClick={async () => {
        if (!calibrated) return;
        setBusy(true);
        try { if (await commit('grid.calibrate', {}, state => resnapSpatialActors({ ...state, grid: calibrated }))) dispatch(cancelGridEditing());
          else setError('Alignment could not be applied. Check canvas fit and validation messages.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Applying…' : 'Apply alignment'}</button>
    </div>
  </AlignmentPanel>;
}
export function GridCalibrationMarkers() {
  const points = useSelector((state: RootState) => state.interaction.gridCalibrationPoints);
  return <g aria-label="Grid alignment points" pointerEvents="none">{points.map((point, i) => <g key={i}>
    <circle cx={point.x} cy={point.y} r={6} className="fill-canvas-ink stroke-canvas-on-ink" />
    <text x={point.x + 9} y={point.y - 9} className="fill-canvas-ink" stroke="white" strokeWidth={0.5} paintOrder="stroke" fontSize={16}>{i + 1}</text>
  </g>)}</g>;
}
