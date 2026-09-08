import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";

export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "combat-zone.interface-preferences";

type InterfacePreferences = {
  autoSelectActiveActor: boolean;
  panWithRightClickDrag: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setPanWithRightClickDrag: (enabled: boolean) => void;
};

const defaultPreferences = {
  autoSelectActiveActor: true,
  panWithRightClickDrag: true
};

const defaultValue: InterfacePreferences = {
  ...defaultPreferences,
  setAutoSelectActiveActor: () => undefined,
  setPanWithRightClickDrag: () => undefined
};

const InterfacePreferenceContext =
  createContext<InterfacePreferences>(defaultValue);

function readPreferences(): typeof defaultPreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "null"
    ) as Partial<typeof defaultPreferences> | null;
    return {
      autoSelectActiveActor:
        typeof stored?.autoSelectActiveActor === "boolean"
          ? stored.autoSelectActiveActor
          : true,
      panWithRightClickDrag:
        typeof stored?.panWithRightClickDrag === "boolean"
          ? stored.panWithRightClickDrag
          : true
    };
  } catch {
    return defaultPreferences;
  }
}

/** Owns durable interface defaults that must not enter encounter history. */
export function InterfacePreferenceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    const reset = () => setPreferences(defaultPreferences);
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === INTERFACE_PREFERENCES_STORAGE_KEY) {
        setPreferences(readPreferences());
      }
    };
    globalThis.addEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
    globalThis.addEventListener("storage", syncFromStorage);
    return () => {
      globalThis.removeEventListener(LOCAL_PREFERENCES_RESET_EVENT, reset);
      globalThis.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  function updatePreferences(update: Partial<typeof defaultPreferences>) {
    setPreferences((current) => {
      const next = { ...current, ...update };
      try {
        localStorage.setItem(
          INTERFACE_PREFERENCES_STORAGE_KEY,
          JSON.stringify(next)
        );
      } catch {
        // Keep the preference usable for this session when storage is unavailable.
      }
      return next;
    });
  }

  return (
    <InterfacePreferenceContext.Provider
      value={{
        ...preferences,
        setAutoSelectActiveActor: (enabled) =>
          updatePreferences({ autoSelectActiveActor: enabled }),
        setPanWithRightClickDrag: (enabled) =>
          updatePreferences({ panWithRightClickDrag: enabled })
      }}
    >
      {children}
    </InterfacePreferenceContext.Provider>
  );
}

export function useInterfacePreferences(): InterfacePreferences {
  return useContext(InterfacePreferenceContext);
}
