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
  KEYBIND_DEFINITIONS,
  type KeybindActionId,
  type KeybindMap
} from "./keybindDefinitions";

export const KEYBIND_STORAGE_KEY = "combat-zone.keybinds";

type KeybindContextValue = {
  bindings: KeybindMap;
  resetBindings: () => void;
  setBinding: (actionId: KeybindActionId, binding: string) => KeybindActionId | null;
};

const defaultValue: KeybindContextValue = {
  bindings: DEFAULT_KEYBINDS,
  resetBindings: () => undefined,
  setBinding: () => null
};

const KeybindContext = createContext<KeybindContextValue>(defaultValue);

function readBindings(): KeybindMap {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYBIND_STORAGE_KEY) ?? "null");
    if (!stored || typeof stored !== "object") return DEFAULT_KEYBINDS;
    const next = { ...DEFAULT_KEYBINDS };
    for (const { editable, id } of KEYBIND_DEFINITIONS) {
      if (!editable) continue;
      const candidate = stored[id];
      if (candidate !== undefined && (typeof candidate !== "string" || !/^[a-z]$/.test(candidate))) {
        return DEFAULT_KEYBINDS;
      }
      if (typeof candidate === "string") next[id] = candidate;
    }
    const editableBindings = KEYBIND_DEFINITIONS
      .filter(({ editable }) => editable)
      .map(({ id }) => next[id]);
    return new Set(editableBindings).size === editableBindings.length
      ? next
      : DEFAULT_KEYBINDS;
  } catch {
    return DEFAULT_KEYBINDS;
  }
}

/** Owns application keybind preferences independently from encounter state. */
export function KeybindProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState(readBindings);

  useEffect(() => {
    const reset = () => setBindings(DEFAULT_KEYBINDS);
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    return () => globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
  }, []);

  function persist(next: KeybindMap) {
    setBindings(next);
    try {
      localStorage.setItem(
        KEYBIND_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(
          KEYBIND_DEFINITIONS
            .filter(({ editable }) => editable)
            .map(({ id }) => [id, next[id]])
        ))
      );
    } catch {
      // The in-memory preference remains usable when storage is unavailable.
    }
  }

  function setBinding(actionId: KeybindActionId, binding: string) {
    const definition = KEYBIND_DEFINITIONS.find(({ id }) => id === actionId);
    if (!definition?.editable) return actionId;
    const conflict = KEYBIND_DEFINITIONS.find(
      ({ editable, id }) => editable && id !== actionId && bindings[id] === binding
    );
    if (conflict) return conflict.id;
    persist({ ...bindings, [actionId]: binding });
    return null;
  }

  function resetBindings() {
    persist(DEFAULT_KEYBINDS);
  }

  return (
    <KeybindContext.Provider value={{ bindings, resetBindings, setBinding }}>
      {children}
    </KeybindContext.Provider>
  );
}

export function useKeybinds(): KeybindContextValue {
  return useContext(KeybindContext);
}
