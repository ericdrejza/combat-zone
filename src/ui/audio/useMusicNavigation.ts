import { useCallback, type RefObject } from "react";

import type { AudioCue } from "@entities/audio/types";
import type { MusicGroupPlayback, PlaybackEntry } from "./audioPlaybackTypes";

type Options = {
  entries: RefObject<Map<string, PlaybackEntry>>;
  musicGroups: RefObject<Map<string, MusicGroupPlayback>>;
  cueSources: RefObject<Map<string, { cue: AudioCue; sourceUrl: string }>>;
  play: (cue: AudioCue, sourceUrl: string) => Promise<void>;
  seek: (cueId: string, time: number) => void;
  stop: (cueId: string) => void;
};

/** Media track navigation respects playlist order and the group's wrap setting. */
export function useMusicNavigation({ entries, musicGroups, cueSources, play, seek, stop }: Options) {
  return useCallback((direction: -1 | 1) => {
    const entry = [...entries.current!.values()].find((candidate) => musicGroups.current!.has(candidate.cue.placement.groupId));
    if (!entry) return;
    if (direction === -1 && entry.audio.currentTime > 3) {
      seek(entry.cue.id, 0);
      return;
    }
    const group = musicGroups.current!.get(entry.cue.placement.groupId)!;
    const index = group.cueIds.indexOf(entry.cue.id);
    if (index < 0) return;
    const nextId = group.cueIds[index + direction] ?? (group.repeat ? direction === 1 ? group.cueIds[0] : group.cueIds.at(-1) : undefined);
    if (!nextId) {
      if (direction === -1) seek(entry.cue.id, 0);
      else stop(entry.cue.id);
      return;
    }
    const next = cueSources.current!.get(nextId);
    if (!next) return;
    stop(entry.cue.id);
    void play(next.cue, next.sourceUrl);
  }, [cueSources, entries, musicGroups, play, seek, stop]);
}
