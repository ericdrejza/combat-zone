import { useEffect, useRef, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { useResolvedImageSource } from '@core/assets/ImageAssetResolver';
import type { EncounterState } from '@core/encounter/types';
import type { GridConfiguration } from '@core/movement/types';
import { isVideoMediaType } from '@library/mediaAsset';
import { detectBackgroundGrid } from './detectBackgroundGrid';
import { alignmentButton } from './AlignmentPanel';

export function GridDetectionButton({ encounter, grid, active, disabled, onStart, onDetected }: {
  encounter: EncounterState; grid: GridConfiguration; active: boolean; disabled: boolean; onStart: () => void; onDetected: (grid: GridConfiguration) => void;
}) {
  const url = useResolvedImageSource(encounter.backgroundImage?.source);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  useEffect(() => { setBusy(false); return () => controller.current?.abort(); }, [encounter, grid.type]);
  useEffect(() => { if (!active) { controller.current?.abort(); setBusy(false); } }, [active]);
  return <>
    <button type="button" disabled={disabled || busy || !url || isVideoMediaType(encounter.backgroundImage?.mediaType)}
      aria-pressed={active} className={`${alignmentButton} inline-flex items-center gap-1 ${active ? 'border-canvas-ink bg-canvas-ink text-canvas-on-ink enabled:hover:bg-canvas-ink enabled:hover:ring-2 enabled:hover:ring-canvas-muted' : ''}`}
      onClick={async () => {
        if (!url) return;
        onStart();
        const abort = new AbortController(); controller.current?.abort(); controller.current = abort;
        setBusy(true); setMessage('Looking for repeated grid lines…');
        try {
          const result = await detectBackgroundGrid(url, { ...encounter, grid }, abort.signal);
          if (abort.signal.aborted) return;
          if (result) { onDetected(result); setMessage('Grid detected. Check the preview, then apply.'); }
          else setMessage('No reliable grid found. Align using vertices instead.');
        } catch (error) { if (!abort.signal.aborted) setMessage(error instanceof Error ? error.message : 'Detection failed. Use vertices instead.'); }
        finally { if (!abort.signal.aborted) setBusy(false); }
      }}><ScanSearch size={14} />{busy ? 'Detecting…' : 'Detect grid'}</button>
    {message && active ? <p role="status" className="w-full text-xs text-canvas-muted">{message}</p> : null}
  </>;
}
