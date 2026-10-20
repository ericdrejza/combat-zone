import { useEffect, useState } from 'react';
import { Angle } from 'lucide-react';

/** Commit on blur/Enter so typing an angle does not apply incomplete numeric drafts. */
export function ConeAngleField({ value, onChange, className }: { value: number; onChange: (angle: number) => void; className: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="flex items-center gap-1 text-xs"><Angle size={18} aria-hidden="true" />
    <span className="relative inline-flex items-center text-sm tabular-nums">
      <input aria-label="Cone angle" className={`${className} h-[54px] tabular-nums lg:h-[42px]`} style={{ width: `calc(${Math.max(2, draft.length) + 1}ch + 2.5rem)` }} type="number" min="1" max="180" value={draft}
        onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
        onChange={event => setDraft(event.currentTarget.value)} onBlur={() => {
          const angle = Number(draft); if (draft.trim() && Number.isFinite(angle) && angle >= 1 && angle <= 180) onChange(angle);
          else setDraft(String(value));
        }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-canvas-ink" style={{ left: `calc(${draft.length}ch + 0.625rem)` }}>°</span>
    </span>
  </label>;
}
