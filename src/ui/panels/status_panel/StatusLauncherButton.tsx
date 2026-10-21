import { SquareActivity } from 'lucide-react';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';
import { useStatusPopout } from './StatusPopoutProvider';

export function StatusLauncherButton() {
  const { statusOpen, openStatus } = useStatusPopout();
  const label = statusOpen ? 'Focus Status window' : 'Open Status window';
  return <TouchTooltip label={label}><button aria-label={label} aria-pressed={statusOpen} title={label} type="button" onClick={openStatus}
    className={`flex h-8 w-8 items-center justify-center rounded-full border hover:ring-2 hover:ring-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink ${statusOpen ? 'border-canvas-ink bg-canvas-ink text-canvas-on-ink hover:bg-canvas-ink/80' : 'border-canvas-line bg-canvas-surface text-canvas-muted hover:bg-canvas'}`}>
    <SquareActivity aria-hidden="true" className="h-4 w-4" />
  </button></TouchTooltip>;
}
