import { useCallback, type RefObject } from "react";

import type { AudioCue } from "@entities/audio/types";
import type { PlaybackEntry, RegisteredAudioCue } from "./audioPlaybackTypes";
import type { AudioTriggerRequest } from "./audioTriggerEvents";

type Options = {
  audioMasterVolume: number;
  cueSources: RefObject<Map<string, RegisteredAudioCue>>;
  entries: RefObject<Map<string, PlaybackEntry>>;
  isCuePaused: (cue: AudioCue) => boolean;
  refresh: () => void;
  restartRepeatedTrigger: (key: string, entry: PlaybackEntry) => void;
};

/** One physical sound per asset per movement, with an entry for every participating cue. */
export function useTriggeredAudioBatch({ audioMasterVolume, cueSources, entries, isCuePaused, refresh, restartRepeatedTrigger }: Options) {
  return useCallback((requests: AudioTriggerRequest[]) => {
    const batches = new Map<string, Array<{ key: string; registered: RegisteredAudioCue }>>();
    const keys = new Set<string>();
    for (const request of requests) {
      const registered = cueSources.current!.get(request.cueId);
      const key = `${request.cueId}:${request.instanceId}`;
      if (!registered || entries.current!.has(key) || keys.has(key)) continue;
      const { cue } = registered;
      if (cue.type !== "effect" || cue.repeat || !cue.triggersEnabled || isCuePaused(cue)) continue;
      keys.add(key);
      const batch = batches.get(registered.assetId) ?? [];
      batch.push({ key, registered });
      batches.set(registered.assetId, batch);
    }
    for (const batch of batches.values()) {
      const audio = new Audio(batch[0].registered.sourceUrl);
      audio.loop = false;
      audio.volume = Math.max(0, Math.min(1, Math.max(...batch.map(({ registered }) => registered.cue.volume)) * audioMasterVolume));
      for (const { key, registered } of batch) {
        entries.current!.set(key, { audio, cue: registered.cue, dueAt: null, remainingDelay: null, status: "playing", timer: null });
      }
      const finish = () => {
        for (const [key, entry] of entries.current!) if (entry.audio === audio) entries.current!.delete(key);
        refresh();
      };
      audio.addEventListener("ended", () => {
        const finished = [...entries.current!].filter(([, entry]) => entry.audio === audio);
        finish();
        // Configuration changes still apply to live cues. Once the shared sound
        // finishes, newly enabled repeats use their independent replay delays.
        for (const [key, entry] of finished) if (entry.cue.repeat) restartRepeatedTrigger(key, entry);
      });
      audio.addEventListener("error", finish);
      audio.addEventListener("timeupdate", refresh);
      audio.addEventListener("durationchange", refresh);
      // A stopped batch's late rejection must not affect a newer batch's entries.
      void audio.play().catch(finish);
    }
    if (batches.size) refresh();
  }, [audioMasterVolume, cueSources, entries, isCuePaused, refresh, restartRepeatedTrigger]);
}
