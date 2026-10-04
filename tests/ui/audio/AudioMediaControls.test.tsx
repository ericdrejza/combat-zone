import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioCue } from "@entities/audio/types";
import { AudioPlaybackProvider, useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";
import { InterfacePreferenceProvider, INTERFACE_PREFERENCES_STORAGE_KEY } from "@ui/interface_preferences/InterfacePreferenceProvider";
import { LOCAL_PREFERENCES_RESET_EVENT } from "@ui/motion_preferences/MotionPreferenceProvider";
import { AudioSettings } from "@ui/settings/AudioSettings";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  duration = 120;
  loop = false;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  volume = 1;
  constructor(readonly src: string) { super(); FakeAudio.instances.push(this); }
}

const music: AudioCue[] = ["first", "second", "last"].map((id) => ({
  id, libraryNodeId: id, placement: { type: "group", groupId: "music" },
  repeat: false, repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 5 },
  triggers: [], triggersEnabled: false, type: "track", volume: 0.5
}));
const ambience: AudioCue = { ...music[0], id: "ambience", placement: { type: "group", groupId: "ambience" }, repeat: true };
const effect: AudioCue = { ...ambience, id: "effect", type: "effect", repeat: false };

function Harness() {
  const playback = useAudioPlayback();
  const [repeat, setRepeat] = useState(false);
  useEffect(() => {
    const unregister = [...music, ambience, effect].map((cue) => playback.registerCueSource(cue, `${cue.id}.mp3`));
    playback.setMusicGroups([{ cueIds: music.map((cue) => cue.id), groupId: "music", repeat }]);
    return () => unregister.forEach((cleanup) => cleanup());
  }, [repeat, playback.registerCueSource, playback.setMusicGroups]);
  return <>
    {[...music, ambience, effect].map((cue) => <button key={cue.id} onClick={() => playback.playRegistered(cue.id)}>Play {cue.id}</button>)}
    <button onClick={() => setRepeat((value) => !value)}>Loop group</button>
    <button onClick={playback.stopAll}>Stop all</button>
    <output aria-label="music status">{music.map((cue) => playback.getStatus(cue.id)).join(":")}</output>
    <output aria-label="other status">{playback.getStatus(ambience.id)}:{playback.getStatus(effect.id)}</output>
    <AudioSettings />
  </>;
}

function renderAudio() {
  return render(<InterfacePreferenceProvider><AudioPlaybackProvider><Harness /></AudioPlaybackProvider></InterfacePreferenceProvider>);
}

describe("keyboard audio transport", () => {
  let handlers: Map<MediaSessionAction, MediaSessionActionHandler | null>;
  let session: { playbackState: string; setActionHandler: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
    FakeAudio.instances = [];
    handlers = new Map();
    session = { playbackState: "none", setActionHandler: vi.fn((action, handler) => handlers.set(action, handler)) };
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("navigator", { mediaSession: session });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(INTERFACE_PREFERENCES_STORAGE_KEY);
  });
  async function play(id: string) { await act(async () => fireEvent.click(screen.getByText(`Play ${id}`))); }
  async function media(action: MediaSessionAction) { await act(async () => handlers.get(action)?.({ action })); }

  it("defaults to Music-only media play/pause and preserves other sounds", async () => {
    renderAudio();
    expect(screen.getByRole("combobox", { name: "Keyboard Play/Pause controls" })).toHaveValue("music");
    await play("ambience");
    await play("effect");
    await play("first");
    await media("pause");
    expect(session.playbackState).toBe("paused");
    expect(screen.getByLabelText("music status")).toHaveTextContent("paused:idle:idle");
    expect(screen.getByLabelText("other status")).toHaveTextContent("playing:playing");
    await media("play");
    expect(session.playbackState).toBe("playing");
    expect(FakeAudio.instances.map((audio) => audio.play.mock.calls.length)).toEqual([1, 1, 2]);
  });

  it("persists All sounds scope, queues an Effect while paused, and restores the default on reset", async () => {
    const firstRender = renderAudio();
    fireEvent.change(screen.getByRole("combobox", { name: "Keyboard Play/Pause controls" }), { target: { value: "all" } });
    expect(JSON.parse(localStorage.getItem(INTERFACE_PREFERENCES_STORAGE_KEY)!).audioMediaKeyScope).toBe("all");
    firstRender.unmount();
    renderAudio();
    expect(screen.getByRole("combobox", { name: "Keyboard Play/Pause controls" })).toHaveValue("all");
    await play("ambience");
    await play("effect");
    await play("first");
    await media("pause");
    expect(screen.getByLabelText("other status")).toHaveTextContent("paused:idle");
    await play("effect");
    const queued = FakeAudio.instances.at(-1)!;
    expect(queued.play).not.toHaveBeenCalled();
    await media("play");
    expect(queued.play).toHaveBeenCalledOnce();
    act(() => globalThis.dispatchEvent(new Event(LOCAL_PREFERENCES_RESET_EVENT)));
    expect(screen.getByRole("combobox", { name: "Keyboard Play/Pause controls" })).toHaveValue("music");
  });

  it.each([2, 3, 4])("restarts only after the three-second threshold (position=%s)", async (time) => {
    renderAudio();
    await play("second");
    const current = FakeAudio.instances[0];
    current.currentTime = time;
    await media("previoustrack");
    if (time > 3) {
      expect(current.currentTime).toBe(0);
      expect(current.pause).not.toHaveBeenCalled();
      expect(FakeAudio.instances).toHaveLength(1);
    } else {
      expect(current.pause).toHaveBeenCalledOnce();
      expect(FakeAudio.instances[1].src).toBe("first.mp3");
    }
  });

  it("restarts the first track and stops after the last when group looping is off", async () => {
    renderAudio();
    await play("first");
    FakeAudio.instances[0].currentTime = 1;
    await media("previoustrack");
    expect(FakeAudio.instances[0].currentTime).toBe(0);
    expect(FakeAudio.instances).toHaveLength(1);
    await play("last");
    await media("nexttrack");
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:idle:idle");
    expect(session.playbackState).toBe("none");
  });

  it("wraps in both directions and queues navigation while paused", async () => {
    renderAudio();
    fireEvent.click(screen.getByText("Loop group"));
    await play("first");
    await media("previoustrack");
    expect(FakeAudio.instances[1].src).toBe("last.mp3");
    await media("pause");
    await media("nexttrack");
    const queued = FakeAudio.instances[2];
    expect(queued.src).toBe("first.mp3");
    expect(queued.play).not.toHaveBeenCalled();
    expect(session.playbackState).toBe("paused");
    await media("play");
    expect(queued.play).toHaveBeenCalledOnce();
  });

  it("handles keyboard media keys when Media Session is unavailable and clears queued playback on Stop", async () => {
    vi.stubGlobal("navigator", {});
    renderAudio();
    await play("first");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    fireEvent.keyDown(window, { key: "MediaTrackNext" });
    expect(FakeAudio.instances[1].src).toBe("second.mp3");
    expect(FakeAudio.instances[1].play).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    await play("last");
    const queued = FakeAudio.instances.at(-1)!;
    fireEvent.click(screen.getByText("Stop all"));
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(queued.play).not.toHaveBeenCalled();
  });

  it("removes native media handlers on unmount", () => {
    const view = renderAudio();
    expect(handlers.get("nexttrack")).toBeTypeOf("function");
    view.unmount();
    for (const action of ["play", "pause", "previoustrack", "nexttrack"] as const) expect(handlers.get(action)).toBeNull();
  });

  it("does not process a native action and its delivered keyboard event twice", async () => {
    renderAudio();
    await play("first");
    await play("effect");
    await media("pause");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("paused:idle:idle");
    await media("nexttrack");
    fireEvent.keyDown(window, { key: "MediaTrackNext" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:paused:idle");
  });

  it("routes All sounds keyboard transport after selecting a non-Music cue", async () => {
    renderAudio();
    fireEvent.change(screen.getByRole("combobox", { name: "Keyboard Play/Pause controls" }), { target: { value: "all" } });
    await play("first");
    await play("ambience");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("paused:idle:idle");
    expect(screen.getByLabelText("other status")).toHaveTextContent("paused:idle");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("playing:idle:idle");
    expect(screen.getByLabelText("other status")).toHaveTextContent("playing:idle");
  });

  it("handles delivered keys after an effect plays, even with native action support", async () => {
    session.setActionHandler.mockImplementation((action, handler) => {
      if (action === "previoustrack") throw new DOMException("Unsupported", "NotSupportedError");
      handlers.set(action, handler);
    });
    renderAudio();
    await play("second");
    await play("effect");
    fireEvent.keyDown(window, { key: "MediaTrackPrevious" });
    expect(FakeAudio.instances.at(-1)!.src).toBe("first.mp3");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("paused:idle:idle");
    expect(screen.getByLabelText("other status")).toHaveTextContent("idle:playing");
    // A native callback for that same hardware key must not toggle twice.
    await media("pause");
    expect(screen.getByLabelText("music status")).toHaveTextContent("paused:idle:idle");
    fireEvent.keyDown(window, { key: "MediaPlayPause" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("playing:idle:idle");
    fireEvent.keyDown(window, { key: "MediaTrackNext" });
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:playing:idle");
  });
});
