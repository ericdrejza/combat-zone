import type { LibrarySectionId } from "@library/types";
import { DEFAULT_LIBRARY_GRID_CARD_SIZE, DEFAULT_LIBRARY_GRID_CARD_SIZES, readLibraryGridCardSizes, type LibraryGridCardSizes, readLibraryGridCardSize, readLibraryViewDefault, type LibraryViewDefault } from "./libraryPreferences";
import { readBackgroundResizeOverflowBehavior, type BackgroundResizeOverflowBehavior } from '@core/encounter/backgroundResizeOverflow';
import { DEFAULT_CLOCK_STYLE, isClockStyle, type ClockStyle } from "@core/entity_resources/clockStyle";
import { readAudioCueVolumeDefault, readAudioRepeatDelayDefaults, readAmbienceCueTypeDefault, readAmbienceDurationThreshold, type AmbienceCueTypeDefault } from "./audioPreferences";
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
  audioAmbienceCueTypeDefault: AmbienceCueTypeDefault;
  audioAmbienceDurationThreshold: number;
  audioMusicCueRepeatDefault: boolean;
  audioMusicGroupLoopDefault: boolean;
  audioMediaKeyScope: "all" | "music";
  audioMasterVolume: number;
  audioRepeatDelayDefaults: AudioRepeatDelaySettings;
  autoSelectActiveActor: boolean;
  enableAssetAnimation: boolean;
  encounterCreationTool: EncounterCreationTool;
  libraryCloseOnOutsideClick: boolean;
  libraryModalViewDefault: LibraryViewDefault;
  libraryPanelViewDefault: LibraryViewDefault;
  libraryGridCardSize: number;
  libraryIndependentGridCardSizes: boolean;
  libraryGridCardSizes: LibraryGridCardSizes;
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
  setAudioAmbienceCueTypeDefault: (value: AmbienceCueTypeDefault) => void;
  setAudioAmbienceDurationThreshold: (seconds: number) => void;
  setAudioMusicCueRepeatDefault: (enabled: boolean) => void;
  setAudioMusicGroupLoopDefault: (enabled: boolean) => void;
  setAudioMediaKeyScope: (scope: "all" | "music") => void;
  setAudioMasterVolume: (volume: number) => void;
  setAudioRepeatDelayDefaults: (settings: AudioRepeatDelaySettings) => void;
  autoSelectActiveActorDefault: boolean;
  setAutoSelectActiveActor: (enabled: boolean) => void;
  setEncounterCreationTool: (tool: EncounterCreationTool) => void;
  setLibraryCloseOnOutsideClick: (enabled: boolean) => void;
  setLibraryModalViewDefault: (view: LibraryViewDefault) => void;
  setLibraryPanelViewDefault: (view: LibraryViewDefault) => void;
  setLibraryGridCardSize: (size: number) => void;
  setLibraryIndependentGridCardSizes: (enabled: boolean) => void;
  setLibrarySectionGridCardSize: (sectionId: LibrarySectionId, size: number) => void;
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
  audioAmbienceCueTypeDefault: "asset_icon",
  audioAmbienceDurationThreshold: 30,
  audioMusicCueRepeatDefault: false,
  audioMusicGroupLoopDefault: true,
  audioMediaKeyScope: "music",
  audioMasterVolume: 1,
  audioRepeatDelayDefaults: { ...DEFAULT_AUDIO_REPEAT_DELAY_SETTINGS },
  autoSelectActiveActor: true,
  enableAssetAnimation: true,
  encounterCreationTool: "zone",
  libraryCloseOnOutsideClick: false,
  libraryModalViewDefault: "grid",
  libraryPanelViewDefault: "grid",
  libraryGridCardSize: DEFAULT_LIBRARY_GRID_CARD_SIZE,
  libraryIndependentGridCardSizes: false,
  libraryGridCardSizes: DEFAULT_LIBRARY_GRID_CARD_SIZES,
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
  setAudioAmbienceCueTypeDefault: () => undefined,
  setAudioAmbienceDurationThreshold: () => undefined,
  setAudioMusicCueRepeatDefault: () => undefined,
  setAudioMusicGroupLoopDefault: () => undefined,
  setAudioMediaKeyScope: () => undefined,
  setAudioMasterVolume: () => undefined,
  setAudioRepeatDelayDefaults: () => undefined,
  setAutoSelectActiveActor: () => undefined,
  setEncounterCreationTool: () => undefined,
  setLibraryCloseOnOutsideClick: () => undefined,
  setLibraryModalViewDefault: () => undefined,
  setLibraryPanelViewDefault: () => undefined,
  setLibraryGridCardSize: () => undefined,
  setLibraryIndependentGridCardSizes: () => undefined,
  setLibrarySectionGridCardSize: () => undefined,
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
      audioAmbienceCueTypeDefault: readAmbienceCueTypeDefault(stored?.audioAmbienceCueTypeDefault),
      audioAmbienceDurationThreshold: readAmbienceDurationThreshold(stored?.audioAmbienceDurationThreshold),
      audioMusicCueRepeatDefault: typeof stored?.audioMusicCueRepeatDefault === "boolean" ? stored.audioMusicCueRepeatDefault : false,
      audioMusicGroupLoopDefault: typeof stored?.audioMusicGroupLoopDefault === "boolean" ? stored.audioMusicGroupLoopDefault : true,
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
      libraryCloseOnOutsideClick: stored?.libraryCloseOnOutsideClick === true,
      libraryModalViewDefault: readLibraryViewDefault(stored?.libraryModalViewDefault),
      libraryPanelViewDefault: readLibraryViewDefault(stored?.libraryPanelViewDefault),
      libraryGridCardSize: readLibraryGridCardSize(stored?.libraryGridCardSize),
      libraryIndependentGridCardSizes: stored?.libraryIndependentGridCardSizes === true,
      libraryGridCardSizes: readLibraryGridCardSizes(stored?.libraryGridCardSizes),
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
