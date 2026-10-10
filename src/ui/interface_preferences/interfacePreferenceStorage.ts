import { readBackgroundResizeOverflowBehavior, type BackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { DEFAULT_CLOCK_STYLE, isClockStyle, type ClockStyle } from "@core/entity_resources/clockStyle";
import { readAudioCueVolumeDefault, readAudioRepeatDelayDefaults } from "./audioPreferences";
import { readPanelVisibility } from "./panelPreferences";
import { DEFAULT_DOCKABLE_PANEL_VISIBILITY, type DockablePanelId, type DockablePanelVisibility } from "@ui/panels/dockablePanelMetadata";
import { DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS, type AudioRepeatDelaySettings } from "@entities/audio/types";
import { DEFAULT_ENCOUNTER_PANEL_ORDER, isEncounterPanelOrder, type EncounterPanelOrder } from "@core/encounter/panelLayout";
export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "combat-zone.interface-preferences";

export type ZoneColorDefaults = {
  border: string | null;
  engagement: string | null;
  zone: string | null;
};

export type EncounterCreationTool = "background" | "zone";

export const DEFAULT_ZONE_COLOR_DEFAULTS: ZoneColorDefaults = {
  border: null,
  engagement: null,
  zone: null
};

export type DurableInterfacePreferences = {
  backgroundResizeOverflowBehavior: BackgroundResizeOverflowBehavior;
  audioCueVolumeDefault: number;
  audioMediaKeyScope: "all" | "music";
  audioMasterVolume: number;
  audioRepeatDelayDefaults: AudioRepeatDelaySettings;
  autoSelectActiveActor: boolean;
  enableAssetAnimation: boolean;
  encounterCreationTool: EncounterCreationTool;
  panelOrder: EncounterPanelOrder;
  panelVisibility: DockablePanelVisibility;
  panWithRightClickDrag: boolean;
  warnActorDestinationsDiffer: boolean;
  keepHealDamageDialogOpen: boolean;
  healthCounterName: string;
  clockStyleDefault: ClockStyle;
  strikethroughDeadInitiativeNames: boolean;
  zoneColorDefaults: ZoneColorDefaults;
  zoneOpacityDefault: number;
  zoneShowBorderDefault: boolean;
};

export type InterfacePreferences = DurableInterfacePreferences & {
  setBackgroundResizeOverflowBehavior: (behavior: BackgroundResizeOverflowBehavior) => void;
  setAudioCueVolumeDefault: (volume: number) => void;
  setAudioMediaKeyScope: (scope: "all" | "music") => void;
  setAudioMasterVolume: (volume: number) => void;
  setAudioRepeatDelayDefaults: (settings: AudioRepeatDelaySettings) => void;
  autoSelectActiveActorDefault: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setEncounterCreationTool: (tool: EncounterCreationTool) => void;
  setPanelOrder: (order: EncounterPanelOrder) => void;
  setEnableAssetAnimation: (enabled: boolean) => void;
  setAutoSelectActiveActorDefault: (enabled: boolean) => void;
  setPanelVisible: (panelId: DockablePanelId, visible: boolean) => void;
  setPanWithRightClickDrag: (enabled: boolean) => void;
  setWarnActorDestinationsDiffer: (enabled: boolean) => void;
  setKeepHealDamageDialogOpen: (enabled: boolean) => void;
  setHealthCounterName: (name: string) => void;
  setClockStyleDefault: (style: ClockStyle) => void;
  setStrikethroughDeadInitiativeNames: (enabled: boolean) => void;
  setZoneColorDefaults: (defaults: ZoneColorDefaults) => void;
  setZoneOpacityDefault: (opacity: number) => void;
  setZoneShowBorderDefault: (showBorder: boolean) => void;
};

export const defaultPreferences: DurableInterfacePreferences = {
  backgroundResizeOverflowBehavior: 'zoneless',
  audioCueVolumeDefault: 0.5,
  audioMediaKeyScope: "music",
  audioMasterVolume: 1,
  audioRepeatDelayDefaults: { ...DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS },
  autoSelectActiveActor: true,
  enableAssetAnimation: true,
  encounterCreationTool: "zone",
  panelOrder: DEFAULT_ENCOUNTER_PANEL_ORDER,
  panelVisibility: DEFAULT_DOCKABLE_PANEL_VISIBILITY,
  panWithRightClickDrag: true,
  warnActorDestinationsDiffer: true,
  keepHealDamageDialogOpen: false,
  healthCounterName: "Hit points",
  clockStyleDefault: DEFAULT_CLOCK_STYLE,
  strikethroughDeadInitiativeNames: true,
  zoneColorDefaults: DEFAULT_ZONE_COLOR_DEFAULTS,
  zoneOpacityDefault: 0.7,
  zoneShowBorderDefault: true
};

export const defaultValue: InterfacePreferences = {
  ...defaultPreferences,
  setBackgroundResizeOverflowBehavior: () => undefined,
  autoSelectActiveActorDefault: true,
  setAudioCueVolumeDefault: () => undefined,
  setAudioMediaKeyScope: () => undefined,
  setAudioMasterVolume: () => undefined,
  setAudioRepeatDelayDefaults: () => undefined,
  setAutoSelectActiveActor: () => undefined,
  setEncounterCreationTool: () => undefined,
  setPanelOrder: () => undefined,
  setEnableAssetAnimation: () => undefined,
  setAutoSelectActiveActorDefault: () => undefined,
  setPanelVisible: () => undefined,
  setPanWithRightClickDrag: () => undefined,
  setWarnActorDestinationsDiffer: () => undefined,
  setKeepHealDamageDialogOpen: () => undefined,
  setHealthCounterName: () => undefined,
  setClockStyleDefault: () => undefined,
  setStrikethroughDeadInitiativeNames: () => undefined,
  setZoneColorDefaults: () => undefined,
  setZoneOpacityDefault: () => undefined,
  setZoneShowBorderDefault: () => undefined
};

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function readPreferences(): DurableInterfacePreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY) ?? "null"
    ) as Partial<DurableInterfacePreferences> | null;
    return {
      backgroundResizeOverflowBehavior: readBackgroundResizeOverflowBehavior(stored?.backgroundResizeOverflowBehavior),
      audioCueVolumeDefault: readAudioCueVolumeDefault(stored?.audioCueVolumeDefault),
      audioMediaKeyScope: stored?.audioMediaKeyScope === "all" ? "all" : "music",
      audioMasterVolume:
        typeof stored?.audioMasterVolume === "number" && stored.audioMasterVolume >= 0 && stored.audioMasterVolume <= 1
          ? stored.audioMasterVolume
          : 1,
      audioRepeatDelayDefaults: readAudioRepeatDelayDefaults(stored?.audioRepeatDelayDefaults),
      autoSelectActiveActor:
        typeof stored?.autoSelectActiveActor === "boolean"
          ? stored.autoSelectActiveActor
          : true,
      enableAssetAnimation:
        typeof stored?.enableAssetAnimation === "boolean"
          ? stored.enableAssetAnimation
          : true,
      encounterCreationTool:
        stored?.encounterCreationTool === "background" ||
        stored?.encounterCreationTool === "zone"
          ? stored.encounterCreationTool
          : defaultPreferences.encounterCreationTool,
      panelOrder: isEncounterPanelOrder(stored?.panelOrder)
        ? stored.panelOrder
        : DEFAULT_ENCOUNTER_PANEL_ORDER,
      panelVisibility: readPanelVisibility(stored?.panelVisibility),
      warnActorDestinationsDiffer: stored?.warnActorDestinationsDiffer !== false,
      keepHealDamageDialogOpen: stored?.keepHealDamageDialogOpen === true,
      panWithRightClickDrag:
        typeof stored?.panWithRightClickDrag === "boolean"
          ? stored.panWithRightClickDrag
          : true,
      clockStyleDefault: isClockStyle(stored?.clockStyleDefault) ? stored.clockStyleDefault : DEFAULT_CLOCK_STYLE,
      healthCounterName: typeof stored?.healthCounterName === "string" && stored.healthCounterName.trim() ? stored.healthCounterName.trim() : "Hit points",
      strikethroughDeadInitiativeNames:
        typeof stored?.strikethroughDeadInitiativeNames === "boolean"
          ? stored.strikethroughDeadInitiativeNames
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
