import { useEffect, useRef, useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import type { RootState } from '@store/store';
import type { GridConfiguration } from '@core/movement/types';
import { setGridAppearancePreview } from '@interaction/interactionState';

type Appearance = Pick<GridConfiguration, 'color' | 'opacity'>;

/** Appearance drafts bypass encounter/layout state and coalesce SVG previews per frame. */
export function useGridAppearanceDraft(grid: GridConfiguration, encounterId: string, disabled: boolean,
  commit: (patch: Partial<GridConfiguration>) => Promise<void>) {
  const dispatch = useDispatch(), store = useStore<RootState>();
  const [draft, setDraft] = useState<Partial<Appearance>>({});
  const pending = useRef<Partial<Appearance>>({});
  const committing = useRef<Partial<Appearance>>({});
  const frame = useRef<number | null>(null), mounted = useRef(true);
  function publish() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const grid = store.getState().encounter.present.grid;
    dispatch(setGridAppearancePreview(Object.keys(pending.current).length
      ? { color: grid.color, opacity: grid.opacity, ...pending.current } : null));
  }
  function preview(patch: Partial<Appearance>) {
    if (disabled) return;
    pending.current = { ...pending.current, ...patch };
    setDraft(pending.current);
    if (frame.current === null) frame.current = requestAnimationFrame(publish);
  }
  function finish(field: keyof Appearance) {
    const value = pending.current[field];
    if (disabled || value === undefined || committing.current[field] === value) return;
    committing.current = { ...committing.current, [field]: value };
    const patch = { [field]: value };
    void commit(patch).finally(() => {
      delete committing.current[field];
      if (!mounted.current || store.getState().encounter.present.id !== encounterId) return;
      if (pending.current[field] === value) {
        delete pending.current[field];
        setDraft({ ...pending.current });
        publish();
      }
    });
  }
  useEffect(() => {
    pending.current = {}; committing.current = {}; setDraft({});
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    dispatch(setGridAppearancePreview(null));
  }, [encounterId, disabled, dispatch]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      dispatch(setGridAppearancePreview(null));
    };
  }, [dispatch]);
  return { color: draft.color ?? grid.color, opacity: draft.opacity ?? grid.opacity, preview, finish };
}
