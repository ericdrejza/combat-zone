import { useCallback, useRef, type RefObject } from "react";

import type { AudioCue, AudioCueGroupSection } from "@entities/audio/types";
import type { AudioPlaybackScope, MusicGroupPlayback, PlaybackEntry } from "./audioPlaybackTypes";

type Options = {
  entries: RefObject<Map<string, PlaybackEntry>>;
  musicGroups: RefObject<Map<string, MusicGroupPlayback>>;
  groupSections: RefObject<Map<string, AudioCueGroupSection>>;
  refresh: () => void;
  scheduleInterval: (entry: PlaybackEntry, delay: number) => void;
  stop: (cueId: string) => void;
};

const SECTIONS: AudioCueGroupSection[] = ["ambiance", "music", "zone", "actor"];
const scopeSections = (scope?: AudioPlaybackScope) => scope === "encounter" ? ["ambiance", "music"] : typeof scope === "string" ? [scope] : scope ? [] : SECTIONS;

/** Section gates also hold new cue requests until that section resumes. */
export function useAudioTransport({ entries, musicGroups, groupSections, refresh, scheduleInterval, stop }: Options) {
  const paused = useRef(new Set<string>());
  const pausedGroups = useRef(new Set<string>());
  const sectionOf = useCallback((cue: AudioCue) => groupSections.current!.get(cue.placement.groupId) ?? (musicGroups.current!.has(cue.placement.groupId) ? "music" : "ambiance"), [groupSections, musicGroups]);
  const isCuePaused = useCallback((cue: AudioCue) => paused.current.has(sectionOf(cue)) || pausedGroups.current.has(cue.placement.groupId), [sectionOf]);

  const matchesScope = useCallback((cue: AudioCue, scope?: AudioPlaybackScope) => typeof scope === "object" ? cue.placement.groupId === scope.groupId : scopeSections(scope).includes(sectionOf(cue)), [sectionOf]);

  const pause = useCallback((scope?: AudioPlaybackScope) => {
    const sections = scopeSections(scope);
    sections.forEach((section) => paused.current.add(section));
    if (typeof scope === "object") pausedGroups.current.add(scope.groupId);
    for (const entry of entries.current!.values()) {
      if (!matchesScope(entry.cue, scope) || entry.status === "paused") continue;
      if (entry.cue.type === "effect" && !entry.cue.repeat) {
        stop(entry.cue.id);
        continue;
      }
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
        entry.remainingDelay = Math.max(0, (entry.dueAt ?? Date.now()) - Date.now());
      } else entry.audio.pause();
      entry.status = "paused";
    }
    refresh();
  }, [entries, matchesScope, refresh, stop]);

  const resume = useCallback((scope?: AudioPlaybackScope) => {
    scopeSections(scope).forEach((section) => paused.current.delete(section));
    if (typeof scope === "object") pausedGroups.current.delete(scope.groupId);
    else for (const groupId of pausedGroups.current) {
      if (!scope || scopeSections(scope).includes(groupSections.current!.get(groupId)!)) pausedGroups.current.delete(groupId);
    }
    for (const entry of entries.current!.values()) {
      if (!matchesScope(entry.cue, scope) || entry.status !== "paused" || typeof scope !== "object" && isCuePaused(entry.cue)) continue;
      if (entry.remainingDelay !== null) scheduleInterval(entry, entry.remainingDelay);
      else {
        entry.status = "playing";
        void entry.audio.play().catch(() => {
          for (const [key, current] of entries.current!) {
            if (current === entry) entries.current!.delete(key);
          }
          refresh();
        });
      }
    }
    refresh();
  }, [entries, groupSections, isCuePaused, matchesScope, refresh, scheduleInterval]);

  const stopAll = useCallback(() => {
    for (const cueId of new Set([...entries.current!.values()].map((entry) => entry.cue.id))) stop(cueId);
    paused.current.clear();
    pausedGroups.current.clear();
    refresh();
  }, [entries, refresh, stop]);
  const pauseAll = useCallback(() => pause(), [pause]);
  const resumeAll = useCallback(() => resume(), [resume]);
  const pauseMusic = useCallback(() => pause("music"), [pause]);
  const resumeMusic = useCallback(() => resume("music"), [resume]);
  const isSectionPaused = useCallback((scope: AudioPlaybackScope) => typeof scope === "object" ? pausedGroups.current.has(scope.groupId) : scopeSections(scope).some((section) => paused.current.has(section)), []);
  const hasSectionPlayback = useCallback((scope: AudioPlaybackScope) => isSectionPaused(scope) || [...entries.current!.values()].some((entry) => matchesScope(entry.cue, scope)), [entries, isSectionPaused, matchesScope]);

  return {
    globallyPaused: SECTIONS.every((section) => paused.current.has(section)),
    hasPausedPlayback: paused.current.size > 0 || pausedGroups.current.size > 0 || [...entries.current!.values()].some((entry) => entry.status === "paused"),
    isCuePaused, musicPaused: paused.current.has("music") || [...entries.current!.values()].some((entry) => sectionOf(entry.cue) === "music" && entry.status === "paused"),
    pauseSection: pause, resumeSection: resume, isSectionPaused, hasSectionPlayback,
    pauseAll, pauseMusic, resumeAll, resumeMusic, stopAll
  };
}
