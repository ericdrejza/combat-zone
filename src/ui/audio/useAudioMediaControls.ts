import { useEffect, useRef } from "react";

type Controls = {
  hasMusicPlayback: boolean;
  skipMusic: (direction: -1 | 1) => void;
  hasPlayback: boolean;
  hasPausedPlayback: boolean;
  musicPaused: boolean;
  pauseAll: () => void;
  pauseMusic: () => void;
  resumeAll: () => void;
  resumeMusic: () => void;
};

/** Routes OS media actions through the same transport as the application UI. */
export function useAudioMediaControls(controls: Controls, scope: "all" | "music", revision: number) {
  const lastAction = useRef<{ command: string; origin: string; time: number } | null>(null);
  const paused = scope === "music" ? controls.musicPaused : controls.hasPausedPlayback;
  const pause = scope === "music" ? controls.pauseMusic : controls.pauseAll;
  const resume = scope === "music" ? controls.resumeMusic : controls.resumeAll;
  const hasPlayback = scope === "music" ? controls.hasMusicPlayback : controls.hasPlayback;
  const skipMusic = controls.skipMusic;

  useEffect(() => {
    const session = navigator.mediaSession;
    const actions: Array<[MediaSessionAction, () => void]> = [
      ["play", resume], ["pause", () => { if (hasPlayback) pause(); }],
      ["previoustrack", () => skipMusic(-1)], ["nexttrack", () => skipMusic(1)]
    ];
    const registered: MediaSessionAction[] = [];
    const dispatchAction = (action: MediaSessionAction, origin: "native" | "keyboard") => {
      const command = action === "play" || action === "pause" ? "transport" : action;
      const time = performance.now();
      const previous = lastAction.current;
      // Some browsers deliver both events for one hardware key press.
      if (previous?.command === command && previous.origin !== origin && time - previous.time < 100) {
        lastAction.current = null;
        return;
      }
      lastAction.current = { command, origin, time };
      actions.find(([name]) => name === action)?.[1]();
    };
    if (session) {
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, () => dispatchAction(action, "native"));
          registered.push(action);
        } catch { /* Unsupported native actions use the keyboard fallback below. */ }
      }
      session.playbackState = !hasPlayback ? "none" : paused ? "paused" : "playing";
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.defaultPrevented) return;
      const action = event.key === "MediaTrackPrevious" ? "previoustrack"
        : event.key === "MediaTrackNext" ? "nexttrack"
        : event.key === "MediaPlayPause" && hasPlayback ? paused ? "play" : "pause" : null;
      // Native support does not guarantee routing after another media item plays.
      if (!action) return;
      event.preventDefault();
      dispatchAction(action, "keyboard");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      for (const action of registered) session.setActionHandler(action, null);
    };
  }, [hasPlayback, pause, paused, resume, skipMusic, revision]);
}
