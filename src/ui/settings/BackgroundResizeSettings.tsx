import { SettingsField, SETTINGS_CONTROL } from './SettingsLayout';
import { readBackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { useInterfacePreferences } from '@ui/interface_preferences/InterfacePreferenceProvider';

/** Controls overflow without changing the grid's scale or encounter validation mode. */
export function BackgroundResizeSettings() {
  const { backgroundResizeOverflowBehavior, setBackgroundResizeOverflowBehavior } = useInterfacePreferences();
  return (
    <SettingsField label="When background resizing puts actors outside the canvas">
      <select
        className={SETTINGS_CONTROL}
        value={backgroundResizeOverflowBehavior}
        onChange={event => setBackgroundResizeOverflowBehavior(readBackgroundResizeOverflowBehavior(event.currentTarget.value))}
      >
        <option value="zoneless">Move actors to Zoneless</option>
        <option value="clamp">Limit resizing to keep actors on canvas</option>
      </select>
    </SettingsField>
  );
}
