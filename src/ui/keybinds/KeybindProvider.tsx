import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import {
  DEFAULT_KEYBINDS,
  isKeybind,
  bindingsConflict,
  KEYBIND_DEFINITIONS,
  type KeybindActionId,
  type KeybindMap
} from "./keybindDefinitions";

export const KEYBIND_STORAGE_KEY = "combat-zone.keybinds";

type KeybindContextValue = {
  bindings: KeybindMap;
  ctrlWheelZoomEnabled: boolean;
  setCtrlWheelZoomEnabled: (enabled: boolean) => void;
  resetBindings: () => void;
  applyBindings: (updates: Partial<KeybindMap>, override?: boolean) => KeybindActionId[];
  setBinding: (actionId: KeybindActionId, binding: string) => KeybindActionId | null;
};

const defaultValue: KeybindContextValue = {
  bindings: DEFAULT_KEYBINDS,
  ctrlWheelZoomEnabled: true,
  setCtrlWheelZoomEnabled: () => undefined,
  resetBindings: () => undefined,
  applyBindings: () => [],
  setBinding: () => null
};

const KeybindContext = createContext<KeybindContextValue>(defaultValue);

function readPreferences(): { bindings: KeybindMap; ctrlWheelZoomEnabled: boolean } {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return { bindings: DEFAULT_KEYBINDS, ctrlWheelZoomEnabled: true };
    const next = { ...DEFAULT_KEYBINDS };
    for (const { editable, id } of KEYBIND_DEFINITIONS) {
      if (!editable) continue;
      const candidate = stored[id];
      if (candidate !== undefined && (!isKeybind(candidate))) {
        return { bindings: DEFAULT_KEYBINDS, ctrlWheelZoomEnabled: true };
      }
      if (typeof candidate === "string") next[id] = candidate;
    }
    // New defaults may conflict with an older customized letter; keep the saved choice.
    const assigned: string[] = [];
    for (const { id } of KEYBIND_DEFINITIONS.filter((d) => !d.editable)) assigned.push(next[id]);
    const ordered = KEYBIND_DEFINITIONS.filter((d) => d.editable).sort((a, b) => Number(typeof stored[b.id] === "string") - Number(typeof stored[a.id] === "string"));
    for (const { id } of ordered) {
      if (assigned.some((binding) => bindingsConflict(binding, next[id]))) next[id] = "";
      if (next[id]) assigned.push(next[id]);
    }
    return {
      bindings: next,
      ctrlWheelZoomEnabled: typeof stored.ctrlWheelZoomEnabled === "boolean" ? stored.ctrlWheelZoomEnabled : true
    };
  } catch {
    return { bindings: DEFAULT_KEYBINDS, ctrlWheelZoomEnabled: true };
  }
}

/** Owns application keybind preferences independently from encounter state. */
export function KeybindProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const { bindings, ctrlWheelZoomEnabled } = preferences;

  useEffect(() => {
    const reset = () => setPreferences({ bindings: DEFAULT_KEYBINDS, ctrlWheelZoomEnabled: true });
    const sync = (event: StorageEvent) => { if (event.key === KEYBIND_STORAGE_KEY) setPreferences(readPreferences()); };
    globalThis.addEventListener("storage", sync);
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    return () => { globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset); globalThis.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    if (!ctrlWheelZoomEnabled) return;
    const preventBrowserZoom = (event: WheelEvent) => {
      if (event.ctrlKey) event.preventDefault();
    };
    globalThis.addEventListener("wheel", preventBrowserZoom, { capture: true, passive: false });
    return () => globalThis.removeEventListener("wheel", preventBrowserZoom, true);
  }, [ctrlWheelZoomEnabled]);

  function persist(next: KeybindMap, nextCtrlWheelZoomEnabled = ctrlWheelZoomEnabled) {
    setPreferences({ bindings: next, ctrlWheelZoomEnabled: nextCtrlWheelZoomEnabled });
    try {
      localStorage.setItem(
        KEYBIND_STORAGE_KEY,
        JSON.stringify({
          ...Object.fromEntries(
            KEYBIND_DEFINITIONS
              .filter(({ editable }) => editable)
              .map(({ id }) => [id, next[id]])
          ),
          ctrlWheelZoomEnabled: nextCtrlWheelZoomEnabled
        })
      );
    } catch {
      // The in-memory preference remains usable when storage is unavailable.
    }
  }

  function applyBindings(updates: Partial<KeybindMap>, override = false): KeybindActionId[] {
    const entries = Object.entries(updates) as [KeybindActionId, string][];
    if (entries.some(([id, binding]) => !KEYBIND_DEFINITIONS.find((d) => d.id === id)?.editable || !isKeybind(binding))) return entries.map(([id]) => id);
    const conflicts = KEYBIND_DEFINITIONS.filter(({ id }) => !(id in updates) && entries.some(([, binding]) => bindingsConflict(bindings[id], binding)));
    if (conflicts.length && (!override || conflicts.some((d) => !d.editable))) return conflicts.map((d) => d.id);
    if (entries.some(([, binding], index) => entries.slice(index + 1).some(([, other]) => bindingsConflict(binding, other)))) return entries.map(([id]) => id);
    const next = { ...bindings, ...updates };
    for (const { id } of conflicts) next[id] = "";
    persist(next);
    return [];
  }

  function setBinding(actionId: KeybindActionId, binding: string) {
    return applyBindings({ [actionId]: binding })[0] ?? null;
  }

  function resetBindings() {
    persist(DEFAULT_KEYBINDS, true);
  }

  function setCtrlWheelZoomEnabled(enabled: boolean) {
    persist(bindings, enabled);
  }

  return (
    <KeybindContext.Provider value={{ bindings, ctrlWheelZoomEnabled, setCtrlWheelZoomEnabled, resetBindings, setBinding, applyBindings }}>
      {children}
    </KeybindContext.Provider>
  );
}

export function useKeybinds(): KeybindContextValue {
  return useContext(KeybindContext);
}
