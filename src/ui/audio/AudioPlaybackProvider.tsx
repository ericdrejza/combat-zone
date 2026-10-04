import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import type { AudioCue, AudioCueGroupSection } from "@entities/audio/types";
import { useInterfacePreferences } from "@ui/interface_preferences/InterfacePreferenceProvider";

import type { AudioPlaybackScope, AudioPlaybackStatus, MusicGroupPlayback, PlaybackEntry, RegisteredAudioCue } from "./audioPlaybackTypes";
import type { AudioTriggerRequest } from "./audioTriggerEvents";
import { useAudioTransport } from "./useAudioTransport";
import { useAudioMediaControls } from "./useAudioMediaControls";
import { useMusicNavigation } from "./useMusicNavigation";
import { useTriggeredAudioBatch } from "./useTriggeredAudioBatch";
import { updatePlaybackVolumes } from "./audioPlaybackVolumes";
export type { AudioPlaybackStatus } from "./audioPlaybackTypes";

type AudioPlaybackContextValue = {
  pauseSection: (scope: AudioPlaybackScope) => void;
  resumeSection: (scope: AudioPlaybackScope) => void;
  isSectionPaused: (scope: AudioPlaybackScope) => boolean;
  hasSectionPlayback: (scope: AudioPlaybackScope) => boolean;
  setAudioGroupSections: (groups: Array<{ id: string; section: AudioCueGroupSection }>) => void;
  activeMusicCueId: string | null;
  hasMusicPlayback: boolean;
  hasRunningPlayback: boolean;
  skipMusic: (direction: -1 | 1) => void;
  globallyPaused: boolean;
  hasPausedPlayback: boolean;
  musicPaused: boolean;
  pauseMusic: () => void;
  resumeMusic: () => void;
  hasPlayback: boolean;
  getProgress: (cueId: string) => { currentTime: number; duration: number };
  getStatus: (cueId: string) => AudioPlaybackStatus;
  pauseAll: () => void;
  play: (cue: AudioCue, sourceUrl: string, instanceId?: string) => Promise<void>;
  playRegistered: (cueId: string, instanceId?: string) => void;
  playTriggeredBatch: (requests: AudioTriggerRequest[]) => void;
  resumeAll: () => void;
  registerCueSource: (cue: AudioCue, sourceUrl: string, assetId?: string) => () => void;
  setMusicGroups: (groups: Array<{ cueIds: string[]; groupId: string; repeat: boolean }>) => void;
  setCueVolume: (cueId: string, volume: number) => void;
  seek: (cueId: string, time: number) => void;
  stop: (cueId: string) => void;
  stopAll: () => void;
};

const AudioPlaybackContext = createContext<AudioPlaybackContextValue | null>(null);
type StartPlayback = (cue: AudioCue, sourceUrl: string, instanceId?: string, startDelay?: number) => Promise<void>;

function nextDelay(cue: AudioCue): number {
  const range = cue.repeatDelay.maximumDelaySeconds - cue.repeatDelay.minimumDelaySeconds;
  return (cue.repeatDelay.minimumDelaySeconds + Math.random() * Math.max(0, range)) * 1000;
}

export function AudioPlaybackProvider({ children }: PropsWithChildren) {
  const { audioMasterVolume, audioMediaKeyScope } = useInterfacePreferences();
  const entries = useRef(new Map<string, PlaybackEntry>());
  const cueSources = useRef(new Map<string, RegisteredAudioCue>());
  const musicGroups = useRef(new Map<string, MusicGroupPlayback>());
  const groupSections = useRef(new Map<string, AudioCueGroupSection>());
  const playRef = useRef<StartPlayback>(async () => undefined);
  const masterVolumeRef = useRef(audioMasterVolume);
  masterVolumeRef.current = audioMasterVolume;
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((current) => current + 1), []);

  const stop = useCallback((cueId: string) => {
    // Stop each physical sound once, including every cue sharing that sound.
    const audioToStop = new Set([...entries.current.values()].filter((entry) => entry.cue.id === cueId).map((entry) => entry.audio));
    for (const [key, entry] of entries.current) {
      if (!audioToStop.has(entry.audio)) continue;
      if (entry.timer) clearTimeout(entry.timer);
      entries.current.delete(key);
    }
    for (const audio of audioToStop) {
      audio.pause();
      try { audio.currentTime = 0; } catch { /* Metadata may not be ready. */ }
    }
    refresh();
  }, [refresh]);

  const scheduleInterval = useCallback((entry: PlaybackEntry, delay: number) => {
    entry.status = "waiting";
    entry.remainingDelay = delay;
    entry.dueAt = Date.now() + delay;
    entry.timer = setTimeout(() => {
      entry.timer = null;
      entry.dueAt = null;
      entry.remainingDelay = null;
      entry.status = "playing";
      entry.audio.currentTime = 0;
      void entry.audio.play().catch(() => {
        for (const [key, current] of entries.current) {
          if (current === entry) entries.current.delete(key);
        }
        refresh();
      });
      refresh();
    }, delay);
    refresh();
  }, [refresh]);

  const { globallyPaused, hasPausedPlayback, isCuePaused, musicPaused, pauseAll, pauseMusic, resumeAll, resumeMusic, stopAll, pauseSection, resumeSection, isSectionPaused, hasSectionPlayback } = useAudioTransport({ entries, musicGroups, groupSections, refresh, scheduleInterval, stop });
  const restartRepeatedTrigger = useCallback((key: string, entry: PlaybackEntry) => {
    const registered = cueSources.current.get(entry.cue.id);
    if (registered) void playRef.current(entry.cue, registered.sourceUrl, key.slice(entry.cue.id.length + 1), nextDelay(entry.cue));
  }, []);
  const playTriggeredBatch = useTriggeredAudioBatch({ audioMasterVolume, cueSources, entries, isCuePaused, refresh, restartRepeatedTrigger });

  const play = useCallback(async (cue: AudioCue, sourceUrl: string, instanceId?: string, startDelay?: number) => {
    const key = instanceId ? `${cue.id}:${instanceId}` : cue.id;
    if (entries.current.has(key) || (instanceId && isCuePaused(cue))) return;
    const musicGroupId = musicGroups.current.has(cue.placement.groupId) ? cue.placement.groupId : null;
    if (musicGroupId) {
      for (const entry of [...entries.current.values()]) {
        if (musicGroups.current.has(entry.cue.placement.groupId)) stop(entry.cue.id);
      }
    }
    const audio = new Audio(sourceUrl);
    audio.loop = cue.type === "track" && cue.repeat;
    audio.volume = Math.max(0, Math.min(1, cue.volume * audioMasterVolume));
    const entry: PlaybackEntry = {
      audio,
      cue,
      dueAt: null,
      remainingDelay: null,
      status: isCuePaused(cue) ? "paused" : "playing",
      timer: null
    };
    entries.current.set(key, entry);
    const removeEntry = () => {
      entries.current.delete(key);
      refresh();
    };
    audio.addEventListener("ended", () => {
      if (entries.current.get(key) !== entry) return;
      if (entry.cue.type === "effect" && entry.cue.repeat) {
        scheduleInterval(entry, nextDelay(entry.cue));
      } else {
        removeEntry();
        if (musicGroupId) {
          const group = musicGroups.current.get(musicGroupId);
          const index = group?.cueIds.indexOf(cue.id) ?? -1;
          const nextId = group?.repeat && index >= 0 ? group.cueIds[index + 1] ?? group.cueIds[0] : undefined;
          const next = nextId ? cueSources.current.get(nextId) : undefined;
          if (next) void playRef.current(next.cue, next.sourceUrl);
        }
      }
    });
    audio.addEventListener("timeupdate", refresh);
    audio.addEventListener("durationchange", refresh);
    refresh();
    if (entry.status === "paused") return;
    if (startDelay !== undefined) { scheduleInterval(entry, startDelay); return; }
    try {
      await audio.play();
    } catch (error) {
      // A stopped/replaced entry or a global pause can cancel a pending play().
      // Its late rejection must not remove a newer playback with the same key.
      if (entries.current.get(key) !== entry || entries.current.get(key)?.status === "paused") return;
      entries.current.delete(key);
      refresh();
      throw error;
    }
  }, [audioMasterVolume, isCuePaused, refresh, scheduleInterval, stop]);
  playRef.current = play;

  const registerCueSource = useCallback((cue: AudioCue, sourceUrl: string, assetId = cue.libraryNodeId) => {
    cueSources.current.set(cue.id, { cue, sourceUrl, assetId });
    // Configuration edits (including undo/redo) also apply to every live instance.
    for (const [key, entry] of entries.current) {
      if (entry.cue.id !== cue.id) continue;
      entry.cue = cue;
      entry.audio.loop = cue.type === "track" && cue.repeat;
      if (cue.type === "effect" && !cue.repeat && entry.remainingDelay !== null) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.audio.pause();
        entry.audio.currentTime = 0;
        entries.current.delete(key);
        refresh();
      }
    }
    updatePlaybackVolumes(entries.current.values(), masterVolumeRef.current);
    return () => {
      const registered = cueSources.current.get(cue.id);
      if (registered?.sourceUrl === sourceUrl) cueSources.current.delete(cue.id);
    };
  }, [refresh]);

  const playRegistered = useCallback((cueId: string, instanceId?: string) => {
    const registered = cueSources.current.get(cueId);
    if (registered) void playRef.current(registered.cue, registered.sourceUrl, instanceId);
  }, []);

  const setMusicGroups = useCallback((groups: Array<{ cueIds: string[]; groupId: string; repeat: boolean }>) => {
    musicGroups.current = new Map(groups.map((group) => [group.groupId, { cueIds: group.cueIds, repeat: group.repeat }]));
  }, []);

  const setAudioGroupSections = useCallback((groups: Array<{ id: string; section: AudioCueGroupSection }>) => {
    groupSections.current = new Map(groups.map((group) => [group.id, group.section]));
  }, []);

  const setCueVolume = useCallback((cueId: string, volume: number) => {
    for (const entry of entries.current.values()) {
      if (entry.cue.id !== cueId) continue;
      entry.cue = { ...entry.cue, volume };
    }
    updatePlaybackVolumes(entries.current.values(), audioMasterVolume);
  }, [audioMasterVolume]);

  const seek = useCallback((cueId: string, time: number) => {
    const entry = [...entries.current.values()].find((candidate) => candidate.cue.id === cueId);
    if (!entry) return;
    const duration = Number.isFinite(entry.audio.duration) ? entry.audio.duration : 0;
    entry.audio.currentTime = Math.max(0, Math.min(duration, time));
    refresh();
  }, [refresh]);

  useEffect(() => {
    updatePlaybackVolumes(entries.current.values(), audioMasterVolume);
  }, [audioMasterVolume]);

  useEffect(() => stopAll, [stopAll]);
  const skipMusic = useMusicNavigation({ entries, musicGroups, cueSources, play, seek, stop });

  const value = useMemo<AudioPlaybackContextValue>(() => ({
    pauseSection, resumeSection, isSectionPaused, hasSectionPlayback, setAudioGroupSections,
    activeMusicCueId: [...entries.current.values()].find((entry) => musicGroups.current.has(entry.cue.placement.groupId))?.cue.id ?? null,
    hasMusicPlayback: [...entries.current.values()].some((entry) => musicGroups.current.has(entry.cue.placement.groupId)),
    hasRunningPlayback: [...entries.current.values()].some((entry) => entry.status !== "paused"),
    skipMusic,
    globallyPaused,
    hasPausedPlayback,
    musicPaused,
    hasPlayback: entries.current.size > 0 || hasPausedPlayback,
    getProgress: (cueId) => {
      const entry = [...entries.current.values()].find((candidate) => candidate.cue.id === cueId);
      const duration = entry?.audio.duration ?? 0;
      return { currentTime: entry?.audio.currentTime ?? 0, duration: Number.isFinite(duration) ? duration : 0 };
    },
    getStatus: (cueId) => [...entries.current.values()].find((entry) => entry.cue.id === cueId)?.status ?? "idle",
    pauseAll,
    pauseMusic,
    play,
    playRegistered,
    playTriggeredBatch,
    registerCueSource,
    resumeAll,
    resumeMusic,
    seek,
    setCueVolume,
    setMusicGroups,
    stop,
    stopAll
  }), [pauseSection, resumeSection, isSectionPaused, hasSectionPlayback, setAudioGroupSections, globallyPaused, hasPausedPlayback, musicPaused, pauseAll, pauseMusic, resumeMusic, play, playRegistered, playTriggeredBatch, registerCueSource, resumeAll, seek, setCueVolume, setMusicGroups, skipMusic, stop, stopAll, version]);

  useAudioMediaControls(value, audioMediaKeyScope, version);
  return <AudioPlaybackContext.Provider value={value}>{children}</AudioPlaybackContext.Provider>;
}

export function useAudioPlayback(): AudioPlaybackContextValue {
  const context = useContext(AudioPlaybackContext);
  if (!context) throw new Error("Audio playback requires AudioPlaybackProvider.");
  return context;
}
