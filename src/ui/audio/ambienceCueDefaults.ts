import type { AudioCueType } from "@entities/audio/types";
import type { LibraryImageAsset } from "@library/types";
import type { AmbienceCueTypeDefault } from "@ui/interface_preferences/audioPreferences";

export function resolveAmbienceCueType(mode: AmbienceCueTypeDefault, asset: LibraryImageAsset, threshold: number, duration: number | null): AudioCueType {
  if (mode === "effect" || mode === "track") return mode;
  if (mode === "duration_threshold" && duration !== null && Number.isFinite(duration) && duration >= 0) return duration > threshold ? "track" : "effect";
  return asset.audioIcon === "music" ? "track" : "effect";
}

/** Read metadata without starting playback or storing derived duration in the Library. */
export function readAudioDuration(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (duration: number | null) => {
      clearTimeout(timeout);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("error", failed);
      audio.removeAttribute("src");
      resolve(duration);
    };
    const loaded = () => finish(Number.isFinite(audio.duration) && audio.duration >= 0 ? audio.duration : null);
    const failed = () => finish(null);
    const timeout = setTimeout(failed, 10000);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("error", failed);
    audio.src = url;
  });
}
