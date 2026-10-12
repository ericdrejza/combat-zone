import { useEncounterTransfers } from "./useEncounterTransfers";
import { useEffect } from 'react';
import { useKeybinds } from '@ui/keybinds';
import { matchesKeybind } from '@ui/keybinds/keybindDefinitions';
import { ignoreShortcut } from '@ui/keybinds/keyboardGuards';
import { useEncounterHistory } from './useEncounterHistory';

export function EncounterHistoryKeyboard() {
  useEncounterTransfers();
  const { bindings } = useKeybinds();
  const { undo, redo } = useEncounterHistory();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing || ignoreShortcut(event)) return;
      const command = matchesKeybind(event, bindings['history.undo']) ? undo
        : matchesKeybind(event, bindings['history.redo']) ? redo : null;
      if (!command) return;
      event.preventDefault();
      if (!event.repeat) command();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [bindings, undo, redo]);
  return null;
}
