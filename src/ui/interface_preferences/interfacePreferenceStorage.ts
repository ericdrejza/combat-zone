import type { PreferenceCategory } from "./preferenceCategories";
import type { SelectionOutlineMode } from "@core/rendering/SelectionOutline";
import {
  DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH, DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH, DEFAULT_EDGE_THICKNESS,
  DEFAULT_ZONE_BORDER_THICKNESS, DEFAULT_ACTOR_BORDER_THICKNESS,
  readSelectionOutlineMode, readSelectionOutlineWidth
} from "./selectionOutlinePreferences";
import type { LibrarySectionId } from "@library/types";
import { DEFAULT_LIBRARY_GRID_CARD_SIZE, DEFAULT_LIBRARY_GRID_CARD_SIZES, readLibraryGridCardSizes, type LibraryGridCardSizes, readLibraryGridCardSize, readLibraryViewDefault, type LibraryViewDefault, readLibraryPanelViewDefault, type LibraryPanelViewMode } from "./libraryPreferences";
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
  actorSelectionOutline: SelectionOutlineMode;
  zoneSelectionOutline: SelectionOutlineMode;
  edgeSelectionAnimation: SelectionOutlineMode;
  actorSelectionOutlineWidth: number;
  zoneSelectionOutlineWidth: number;
  edgeThickness: number;
  zoneBorderThickness: number;
  actorBorderThickness: number;
  encounterCreationTool: EncounterCreationTool;
  libraryCloseOnOutsideClick: boolean;
  libraryModalViewDefault: LibraryViewDefault;
  libraryPanelViewDefault: LibraryPanelViewMode;
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
  resetCategory: (category: PreferenceCategory) => void;
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
  setLibraryPanelViewDefault: (view: LibraryPanelViewMode) => void;
  setLibraryGridCardSize: (size: number) => void;
  setLibraryIndependentGridCardSizes: (enabled: boolean) => void;
  setLibrarySectionGridCardSize: (sectionId: LibrarySectionId, size: number) => void;
  setPanelOrder: (order: EncounterPanelOrder) => void;
  setEnableAssetAnimation: (enabled: boolean) => void;
  setActorSelectionOutline: (mode: SelectionOutlineMode) => void;
  setZoneSelectionOutline: (mode: SelectionOutlineMode) => void;
  setEdgeSelectionAnimation: (mode: SelectionOutlineMode) => void;
  setActorSelectionOutlineWidth: (width: number) => void;
  setZoneSelectionOutlineWidth: (width: number) => void;
  setEdgeThickness: (width: number) => void;
  setZoneBorderThickness: (width: number) => void;
  setActorBorderThickness: (width: number) => void;
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
  actorSelectionOutline: "static",
  zoneSelectionOutline: "static",
  edgeSelectionAnimation: "static",
  actorSelectionOutlineWidth: DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH,
  zoneSelectionOutlineWidth: DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH,
  edgeThickness: DEFAULT_EDGE_THICKNESS,
  zoneBorderThickness: DEFAULT_ZONE_BORDER_THICKNESS,
  actorBorderThickness: DEFAULT_ACTOR_BORDER_THICKNESS,
  encounterCreationTool: "zone",
  libraryCloseOnOutsideClick: false,
  libraryModalViewDefault: "grid",
  libraryPanelViewDefault: "two-column",
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
  resetCategory: () => undefined,
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
  setActorSelectionOutline: () => undefined,
  setZoneSelectionOutline: () => undefined,
  setEdgeSelectionAnimation: () => undefined,
  setActorSelectionOutlineWidth: () => undefined,
  setZoneSelectionOutlineWidth: () => undefined,
  setEdgeThickness: () => undefined,
  setZoneBorderThickness: () => undefined,
  setActorBorderThickness: () => undefined,
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
      actorSelectionOutline: readSelectionOutlineMode(stored?.actorSelectionOutline),
      zoneSelectionOutline: readSelectionOutlineMode(stored?.zoneSelectionOutline),
      edgeSelectionAnimation: readSelectionOutlineMode(stored?.edgeSelectionAnimation),
      actorSelectionOutlineWidth: readSelectionOutlineWidth(stored?.actorSelectionOutlineWidth, DEFAULT_ACTOR_SELECTION_OUTLINE_WIDTH),
      zoneSelectionOutlineWidth: readSelectionOutlineWidth(stored?.zoneSelectionOutlineWidth, DEFAULT_ZONE_SELECTION_OUTLINE_WIDTH),
      edgeThickness: readSelectionOutlineWidth(stored?.edgeThickness, DEFAULT_EDGE_THICKNESS),
      zoneBorderThickness: readSelectionOutlineWidth(stored?.zoneBorderThickness, DEFAULT_ZONE_BORDER_THICKNESS),
      actorBorderThickness: readSelectionOutlineWidth(stored?.actorBorderThickness, DEFAULT_ACTOR_BORDER_THICKNESS),
      encounterCreationTool:
        stored?.encounterCreationTool === "background" ||
        stored?.encounterCreationTool === "zone"
          ? stored.encounterCreationTool
          : defaultPreferences.encounterCreationTool,
      libraryCloseOnOutsideClick: stored?.libraryCloseOnOutsideClick === true,
      libraryModalViewDefault: readLibraryViewDefault(stored?.libraryModalViewDefault),
      libraryPanelViewDefault: readLibraryPanelViewDefault(stored?.libraryPanelViewDefault),
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
