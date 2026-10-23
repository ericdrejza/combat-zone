import { useCallback, useEffect, useId } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setNamePreview, clearNamePreview } from '@interaction/interactionState';
import type { NamePreview } from '@interaction/namePreviewState';
import type { RootState } from '@store/store';

/** An editor owns its preview so stale cleanup cannot erase a newer editor's text. */
export function useNamePreview(kind: NamePreview['kind'], ids: string[]) {
  const owner = useId(), dispatch = useDispatch();
  const encounterId = useSelector((state: RootState) => state.encounter.present.id);
  const idsKey = JSON.stringify(ids);
  useEffect(() => () => { dispatch(clearNamePreview(owner)); }, [dispatch, owner, kind, idsKey, encounterId]);
  return useCallback((name: string | null) => {
    if (name === null) dispatch(clearNamePreview(owner));
    else dispatch(setNamePreview({ owner, encounterId, kind, ids: JSON.parse(idsKey) as string[], name: name.trim() }));
  }, [dispatch, owner, encounterId, kind, idsKey]);
}
