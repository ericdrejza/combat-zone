import { Redo2, Undo2 } from 'lucide-react';
import { useKeybinds } from '@ui/keybinds';
import { formatKeybind } from '@ui/keybinds/keybindDefinitions';
import { TouchTooltip } from '@ui/toolbar/TouchTooltip';
import { useEncounterHistory } from './useEncounterHistory';

export function EncounterHistoryControls({ vertical = false }: { vertical?: boolean }) {
  const { canUndo, canRedo, undo, redo } = useEncounterHistory();
  const { bindings } = useKeybinds();
  const controls = [
    { label: 'Undo', icon: Undo2, available: canUndo, action: undo, binding: bindings['history.undo'] },
    { label: 'Redo', icon: Redo2, available: canRedo, action: redo, binding: bindings['history.redo'] }
  ];
  return (
    <div aria-label="Encounter history" role="group" className={`flex shrink-0 gap-2 ${vertical ? 'flex-col' : ''}`}>
      {controls.map(({ label, icon: Icon, available, action, binding }) => {
        const tooltip = binding ? `${label} (${formatKeybind(binding)})` : label;
        return <TouchTooltip key={label} label={tooltip}>
          <button aria-label={label} title={tooltip} disabled={!available} onClick={action} type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-canvas-line bg-canvas-panel text-canvas-muted shadow-sm enabled:hover:bg-canvas-surface enabled:hover:text-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink disabled:cursor-not-allowed disabled:opacity-40">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </button>
        </TouchTooltip>;
      })}
    </div>
  );
}
