import { useEffect, useState } from 'react';
import type { CanvasSize } from '@core/layout/polygonCanvasBounds';
import { PLAYER_ASPECT_RATIOS, normalizePlayerAspectRatio, validPlayerAspectRatio } from './playerAspectRatio';

const control = 'min-w-0 rounded-lg border border-canvas-line bg-canvas-surface px-2 py-1 text-sm text-canvas-ink hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink';

/** Custom drafts never replace a valid frame until both dimensions are valid. */
export function PlayerAspectRatioControl({ value, onChange, label = 'Player aspect ratio' }: {
  value: CanvasSize; onChange: (size: CanvasSize) => void; label?: string;
}) {
  const preset = PLAYER_ASPECT_RATIOS.find(ratio => ratio.width / ratio.height === value.width / value.height);
  const [custom, setCustom] = useState(!preset);
  const [width, setWidth] = useState(String(value.width));
  const [height, setHeight] = useState(String(value.height));
  useEffect(() => { setWidth(String(value.width)); setHeight(String(value.height)); }, [value.width, value.height]);
  const draft = { width: Number(width), height: Number(height) };
  const valid = /^\d+$/.test(width) && /^\d+$/.test(height) && validPlayerAspectRatio(draft);
  return <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
    <legend className="sr-only">{label}</legend>
    <select aria-label={label} className={control} value={custom || !preset ? 'custom' : `${preset.width}:${preset.height}`} onChange={event => {
      const selected = event.currentTarget.value;
      setCustom(selected === 'custom');
      if (selected !== 'custom') { const [width, height] = selected.split(':').map(Number); onChange(normalizePlayerAspectRatio({ width, height })); }
    }}>
      {PLAYER_ASPECT_RATIOS.map(ratio => <option key={`${ratio.width}:${ratio.height}`} value={`${ratio.width}:${ratio.height}`}>{ratio.width}:{ratio.height}</option>)}
      <option value="custom">Custom</option>
    </select>
    {custom || !preset ? <>
      <input aria-label={`${label} width`} aria-invalid={!valid} className={`${control} w-24`} inputMode="numeric" value={width} onChange={event => setWidth(event.currentTarget.value)} />
      <span aria-hidden="true">:</span>
      <input aria-label={`${label} height`} aria-invalid={!valid} className={`${control} w-24`} inputMode="numeric" value={height} onChange={event => setHeight(event.currentTarget.value)} />
      <button className={`${control} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-canvas-line`} disabled={!valid} onClick={() => onChange(normalizePlayerAspectRatio(draft))} type="button">Apply ratio</button>
      {!valid ? <span className="text-sm text-canvas-muted" role="alert">Enter positive whole numbers for the ratio.</span> : null}
    </> : null}
  </fieldset>;
}
