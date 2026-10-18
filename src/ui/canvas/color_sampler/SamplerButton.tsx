import { Pipette } from 'lucide-react';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';

export function SamplerButton({ label, active, disabled, onClick }: { label: string; active: boolean; disabled?: boolean; onClick: () => void }) {
  return <TouchTooltip label={label}><button type="button" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`inline-flex h-8 w-8 items-center justify-center rounded-full border enabled:hover:ring-2 enabled:hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-canvas-ink bg-canvas-ink text-canvas-on-ink' : 'border-canvas-line text-canvas-ink enabled:hover:bg-canvas'}`}>
    <Pipette aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip>;
}
