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

export type ZoneColorDefaults = {
  border: string | null;
  engagement: string | null;
  zone: string | null;
};

export const DEFAULT_ZONE_COLOR_DEFAULTS: ZoneColorDefaults = {
  border: null,
  engagement: null,
  zone: null
};

type DurableInterfacePreferences = {
  autoSelectActiveActor: boolean;
  panelVisibility: DockablePanelVisibility;
  panWithRightClickDrag: boolean;
  zoneColorDefaults: ZoneColorDefaults;
  zoneOpacityDefault: number;
  zoneShowBorderDefault: boolean;
};

type InterfacePreferences = DurableInterfacePreferences & {
  autoSelectActiveActorDefault: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setAutoSelectActiveActorDefault: (enabled: boolean) => void;
  setPanelVisible: (panelId: DockablePanelId, visible: boolean) => void;
  setPanWithRightClickDrag: (enabled: boolean) => void;
  setZoneColorDefaults: (defaults: ZoneColorDefaults) => void;
  setZoneOpacityDefault: (opacity: number) => void;
  setZoneShowBorderDefault: (showBorder: boolean) => void;
};

const defaultPreferences: DurableInterfacePreferences = {
  autoSelectActiveActor: true,
  panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  panWithRightClickDrag: true,
  zoneColorDefaults: DEFAULT_ZONE_COLOR_DEFAULTS,
  zoneOpacityDefault: 0.7,
  zoneShowBorderDefault: true
};

const defaultValue: InterfacePreferences = {
  ...defaultPreferences,
  autoSelectActiveActorDefault: true,
  setAutoSelectActiveActor: () => undefined,
  setAutoSelectActiveActorDefault: () => undefined,
  setPanelVisible: () => undefined,
  setPanWithRightClickDrag: () => undefined,
  setZoneColorDefaults: () => undefined,
  setZoneOpacityDefault: () => undefined,
  setZoneShowBorderDefault: () => undefined
};

const InterfacePreferenceContext =
  createContext<InterfacePreferences>(defaultValue);

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function readPreferences(): DurableInterfacePreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "null"
    ) as Partial<DurableInterfacePreferences> | null;
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
          : true,
      zoneColorDefaults: {
        border: isHexColor(stored?.zoneColorDefaults?.border)
          ? stored.zoneColorDefaults.border.toLowerCase()
          : null,
        engagement: isHexColor(stored?.zoneColorDefaults?.engagement)
          ? stored.zoneColorDefaults.engagement.toLowerCase()
          : null,
        zone: isHexColor(stored?.zoneColorDefaults?.zone)
          ? stored.zoneColorDefaults.zone.toLowerCase()
          : null
      },
      zoneOpacityDefault:
        typeof stored?.zoneOpacityDefault === "number" &&
        stored.zoneOpacityDefault >= 0 &&
        stored.zoneOpacityDefault <= 1
          ? stored.zoneOpacityDefault
          : defaultPreferences.zoneOpacityDefault,
      zoneShowBorderDefault:
        typeof stored?.zoneShowBorderDefault === "boolean"
          ? stored.zoneShowBorderDefault
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
          updatePreferences({ panWithRightClickDrag: enabled }),
        setZoneColorDefaults: (zoneColorDefaults) =>
          updatePreferences({ zoneColorDefaults }),
        setZoneOpacityDefault: (zoneOpacityDefault) =>
          updatePreferences({ zoneOpacityDefault }),
        setZoneShowBorderDefault: (zoneShowBorderDefault) =>
          updatePreferences({ zoneShowBorderDefault })
      }}
    >
      {children}
    </InterfacePreferenceContext.Provider>
  );
}

export function useInterfacePreferences(): InterfacePreferences {
  return useContext(InterfacePreferenceContext);
}
