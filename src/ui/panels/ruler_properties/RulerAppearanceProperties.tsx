import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { LockedRuler } from '@core/measurement/types';
import { setRulerAppearancePreview, updateLockedRuler } from '@interaction/interactionState';
import type { RootState } from '@store/store';
import { useCanvasPreferences } from '@ui/canvas_preferences/useCanvasPreferences';
import { ColorOpacityFields, type ColorOpacity } from '@ui/controls/ColorOpacityFields';

/** Preview continuous gestures; completed changes commit once or join the active ruler draft. */
export function RulerAppearanceProperties({ ruler, readOnly }: { ruler: LockedRuler; readOnly: boolean }) {
  const dispatch = useDispatch(), encounterId = useSelector((state: RootState) => state.encounter.present.id);
  const { preferences } = useCanvasPreferences();
  const effective = { color: ruler.color ?? preferences.rulerColor, opacity: ruler.opacity ?? preferences.rulerOpacity };
  const [draft, setDraft] = useState<ColorOpacity | null>(null);
  useEffect(() => () => { dispatch(setRulerAppearancePreview(null)); }, [dispatch]);
  const cancel = () => { setDraft(null); dispatch(setRulerAppearancePreview(null)); };
  return <fieldset aria-label="Ruler appearance" disabled={readOnly} className="min-w-0 space-y-3">
    <ColorOpacityFields label="Ruler" keepPickerOpen value={draft ?? effective} onCancel={cancel}
      onChange={next => { if (readOnly) return; setDraft(next); dispatch(setRulerAppearancePreview({ ...next, id: ruler.id, encounterId })); }}
      onCommit={next => {
        if (readOnly) return;
        dispatch(updateLockedRuler({ id: ruler.id, color: next.color === effective.color ? ruler.color : next.color, opacity: next.opacity === effective.opacity ? ruler.opacity : next.opacity }));
        cancel();
      }} />
  </fieldset>;
}
