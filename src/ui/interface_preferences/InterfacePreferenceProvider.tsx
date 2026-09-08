import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState
} from "react";

import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import {
  DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  type DockablePanelId,
  type DockablePanelVisibility
} from "@ui/panels/dockablePanelMetadata";

export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "combat-zone.interface-preferences";

type InterfacePreferences = {
  autoSelectActiveActor: boolean;
  autoSelectActiveActorDefault: boolean;
  panelVisibility: DockablePanelVisibility;
  panWithRightClickDrag: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setAutoSelectActiveActorDefault: (enabled: boolean) => void;
  setPanelVisible: (panelId: DockablePanelId, visible: boolean) => void;
  setPanWithRightClickDrag: (enabled: boolean) => void;
};

const defaultPreferences = {
  autoSelectActiveActor: true,
  panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  panWithRightClickDrag: true
};

const defaultValue: InterfacePreferences = {
  ...defaultPreferences,
  autoSelectActiveActorDefault: true,
  setAutoSelectActiveActor: () => undefined,
  setAutoSelectActiveActorDefault: () => undefined,
  setPanelVisible: () => undefined,
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
      panelVisibility: {
        initiative:
          typeof stored?.panelVisibility?.initiative === "boolean"
            ? stored.panelVisibility.initiative
            : true,
        library:
          typeof stored?.panelVisibility?.library === "boolean"
            ? stored.panelVisibility.library
            : true,
        log:
          typeof stored?.panelVisibility?.log === "boolean"
            ? stored.panelVisibility.log
            : true,
        properties:
          typeof stored?.panelVisibility?.properties === "boolean"
            ? stored.panelVisibility.properties
            : true,
        status:
          typeof stored?.panelVisibility?.status === "boolean"
            ? stored.panelVisibility.status
            : true
      },
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
  const [autoSelectActiveActor, setAutoSelectActiveActor] = useState(
    preferences.autoSelectActiveActor
  );

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
        autoSelectActiveActor,
        autoSelectActiveActorDefault: preferences.autoSelectActiveActor,
        setAutoSelectActiveActor,
        setAutoSelectActiveActorDefault: (enabled) =>
          updatePreferences({ autoSelectActiveActor: enabled }),
        setPanelVisible: (panelId, visible) =>
          updatePreferences({
            panelVisibility: {
              ...preferences.panelVisibility,
              [panelId]: visible
            }
          }),
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
