import { readBackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { useInterfacePreferences } from '@ui/interface_preferences/InterfacePreferenceProvider';

/** Controls overflow without changing the grid's scale or encounter validation mode. */
export function BackgroundResizeSettings() {
  const { backgroundResizeOverflowBehavior, setBackgroundResizeOverflowBehavior } = useInterfacePreferences();
  return (
    <label className="flex flex-col gap-2 py-3 text-sm">
      <span>When background resizing puts actors outside the canvas</span>
      <select
        className="w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 hover:border-canvas-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canvas-ink"
        value={backgroundResizeOverflowBehavior}
        onChange={event => setBackgroundResizeOverflowBehavior(readBackgroundResizeOverflowBehavior(event.currentTarget.value))}
      >
        <option value="zoneless">Move actors to Zoneless</option>
        <option value="clamp">Limit resizing to keep actors on canvas</option>
      </select>
    </label>
  );
}
