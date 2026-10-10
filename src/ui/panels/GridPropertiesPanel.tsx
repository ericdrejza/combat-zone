import { useEffect, useState } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import type { RootState } from '@store/store';
import { setGridPreview } from '@interaction/interactionState';
import { validGrid } from '@core/movement/types';
import { resnapSpatialActors } from '@core/movement/movementStrategies';
import { usePersistence } from '@ui/persistence/PersistenceProvider';
import { useKeyboardEncounterCommit } from '@ui/canvas/useKeyboardEncounterCommit';
import { GridSettingsFields, gridSettingsButton } from '@ui/toolbar/grid/GridSettingsFields';

/** Grid edits preview independently of calibration and enter history only on Apply. */
export function GridPropertiesPanel() {
  const encounter = useSelector((state: RootState) => state.encounter.present);
  const aligning = useSelector((state: RootState) => state.interaction.gridCalibrationActive);
  const [draft, setDraft] = useState(encounter.grid);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const { readOnly } = usePersistence();
  const dispatch = useDispatch(), store = useStore<RootState>();
  const commit = useKeyboardEncounterCommit();
  useEffect(() => { setDraft(encounter.grid); setError(''); }, [encounter]);
  useEffect(() => {
    if (!aligning && validGrid(draft)) dispatch(setGridPreview(draft));
    return () => {
      if (store.getState().interaction.gridPreview === draft) dispatch(setGridPreview(null));
    };
  }, [aligning, draft, dispatch, store]);
  return <form aria-label="Grid properties" className="space-y-4" onSubmit={async event => {
    event.preventDefault();
    if (readOnly || busy || aligning || !validGrid(draft)) return;
    setBusy(true); setError('');
    try {
      if (!await commit('grid.update', {}, state => resnapSpatialActors({ ...state, grid: draft }), () => store.getState().encounter.present === encounter && store.getState().interaction.activeToolId === 'grid' && !store.getState().interaction.gridCalibrationActive))
        setError('Grid changes could not be applied. Check canvas fit and validation messages.');
    } finally { setBusy(false); }
  }}>
    <h3 className="font-display text-lg font-semibold">Grid settings</h3>
    <fieldset disabled={readOnly || busy || aligning} className="space-y-4 disabled:opacity-50">
      <GridSettingsFields draft={draft} setDraft={setDraft} compact />
      <div className="flex flex-wrap justify-end gap-2">
        <button className={gridSettingsButton} type="button" onClick={() => { setDraft(encounter.grid); setError(''); }}>Cancel</button>
        <button className={gridSettingsButton} type="submit" disabled={!validGrid(draft) || draft === encounter.grid}>{busy ? 'Applying…' : 'Apply'}</button>
      </div>
    </fieldset>
    {aligning ? <p className="text-sm text-canvas-muted">Finish or cancel alignment to edit grid settings.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
  </form>;
}
