import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioCue } from "@entities/audio/types";
import {
  AudioPlaybackProvider,
  useAudioPlayback
} from "@ui/audio/AudioPlaybackProvider";

vi.mock("@ui/interface_preferences/InterfacePreferenceProvider", () => ({
  useInterfacePreferences: () => ({ audioMasterVolume: 0.5 })
}));

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  loop = false;
  pause = vi.fn();
  play = vi.fn(async (): Promise<void> => undefined);
  volume = 1;

  constructor(readonly src: string) {
    super();
    FakeAudio.instances.push(this);
  }
}

const loopCue: AudioCue = {
  id: "loop",
  repeatDelay: {
    maximumDelaySeconds: 60,
    minimumDelaySeconds: 30,
  },
  libraryNodeId: "loop-node",
  placement: { type: "group", groupId: "ambience" },
  repeat: true,
  triggers: [],
  type: "loop",
  volume: 0.8
};

const oneShotCue: AudioCue = {
  ...loopCue,
  id: "shot",
  libraryNodeId: "shot-node",
  repeat: false,
  type: "one_shot"
};

const nonRepeatingLoopCue: AudioCue = {
  ...loopCue,
  id: "single-loop",
  repeat: false
};

function Harness() {
  const playback = useAudioPlayback();
  return <>
    <button onClick={() => void playback.play(loopCue, "loop.mp3")}>Loop</button>
    <button onClick={() => void playback.play(oneShotCue, "shot.mp3")}>Shot</button>
    <button onClick={() => void playback.play(oneShotCue, "shot.mp3", `trigger-${FakeAudio.instances.length}`)}>Triggered shot</button>
    <button onClick={() => void playback.play(nonRepeatingLoopCue, "single-loop.mp3")}>Single loop</button>
    <button onClick={playback.pauseAll}>Pause all</button>
    <button onClick={playback.resumeAll}>Resume all</button>
    <button onClick={playback.pauseMusic}>Pause music</button>
    <button onClick={playback.resumeMusic}>Resume music</button>
    <button onClick={playback.stopAll}>Stop all</button>
    <output aria-label="playback status">{playback.globallyPaused ? "paused" : "running"}:{playback.getStatus("loop")}:{playback.getStatus("shot")}</output>
    <output aria-label="has playback">{String(playback.hasPlayback)}</output>
  </>;
}

function MusicHarness() {
  const playback = useAudioPlayback();
  const [repeat, setRepeat] = useState(true);
  const first: AudioCue = { ...nonRepeatingLoopCue, id: "music-1", placement: { type: "group", groupId: "music" } };
  const second: AudioCue = { ...nonRepeatingLoopCue, id: "music-2", placement: { type: "group", groupId: "music" } };
  const other: AudioCue = { ...nonRepeatingLoopCue, id: "other-music", placement: { type: "group", groupId: "other-music-group" } };
  useEffect(() => {
    const unregisterFirst = playback.registerCueSource(first, "first.mp3");
    const unregisterSecond = playback.registerCueSource(second, "second.mp3");
    const unregisterOther = playback.registerCueSource(other, "other.mp3");
    playback.setMusicGroups([
      { cueIds: [first.id, second.id], groupId: "music", repeat },
      { cueIds: [other.id], groupId: "other-music-group", repeat: false }
    ]);
    return () => { unregisterFirst(); unregisterSecond(); unregisterOther(); };
  }, [playback.registerCueSource, playback.setMusicGroups, repeat]);
  return <><button onClick={() => setRepeat((value) => !value)}>Toggle playlist repeat</button><button onClick={() => void playback.play(first, "first.mp3")}>First track</button><button onClick={() => void playback.play(second, "second.mp3")}>Second track</button><button onClick={() => playback.playRegistered(other.id)}>Other group track</button><output aria-label="music status">{playback.getStatus(first.id)}:{playback.getStatus(other.id)}</output></>;
}

describe("AudioPlaybackProvider", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("applies master and cue volume and stops with a reset", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Loop" })));
    const audio = FakeAudio.instances[0];

    expect(audio.loop).toBe(true);
    expect(audio.volume).toBe(0.4);
    expect(audio.play).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Stop all" }));
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
    expect(screen.getByLabelText("playback status")).toHaveTextContent("running:idle:idle");
  });

  it("ignores a stopped play request's rejection without clearing its replacement", async () => {
    let rejectPlay: (error: Error) => void = () => undefined;
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    // The first request stays pending until a replacement has started.
    const originalAudio = FakeAudio;
    class PendingAudio extends originalAudio {
      constructor(src: string) {
        super(src);
        if (originalAudio.instances.length === 1) this.play = vi.fn(() => new Promise<void>((_, reject) => { rejectPlay = reject; }));
      }
    }
    vi.stubGlobal("Audio", PendingAudio);
    fireEvent.click(screen.getByRole("button", { name: "Loop" }));
    fireEvent.click(screen.getByRole("button", { name: "Stop all" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Loop" })));
    await act(async () => rejectPlay(new DOMException("Playback cancelled", "AbortError")));
    expect(screen.getByLabelText("playback status")).toHaveTextContent("running:playing:idle");
    act(() => FakeAudio.instances[0].dispatchEvent(new Event("ended")));
    expect(screen.getByLabelText("has playback")).toHaveTextContent("true");
  });

  it("stops one-shots, pauses loops, and resumes only resumable cues", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Loop" }));
      fireEvent.click(screen.getByRole("button", { name: "Shot" }));
    });
    const [loop, shot] = FakeAudio.instances;

    fireEvent.click(screen.getByRole("button", { name: "Pause all" }));
    expect(loop.pause).toHaveBeenCalledOnce();
    expect(shot.pause).toHaveBeenCalledOnce();
    expect(shot.currentTime).toBe(0);
    expect(screen.getByLabelText("playback status")).toHaveTextContent("paused:paused:idle");

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resume all" })));
    expect(loop.play).toHaveBeenCalledTimes(2);
    expect(shot.play).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("playback status")).toHaveTextContent("running:playing:idle");
  });

  it("allows automatic one-shot instances to overlap", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Triggered shot" }));
      fireEvent.click(screen.getByRole("button", { name: "Triggered shot" }));
    });
    expect(FakeAudio.instances).toHaveLength(2);
    const pauseAll = screen.getByRole("button", { name: "Pause all" });
    expect(pauseAll).toBeEnabled();
    fireEvent.click(pauseAll);
    expect(FakeAudio.instances.map((audio) => audio.pause.mock.calls.length)).toEqual([1, 1]);
    expect(FakeAudio.instances.map((audio) => audio.currentTime)).toEqual([0, 0]);
  });

  it("disposes a non-repeating loop after it ends", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Single loop" })));
    expect(FakeAudio.instances[0].loop).toBe(false);
    act(() => FakeAudio.instances[0].dispatchEvent(new Event("ended")));
    expect(screen.getByLabelText("has playback")).toHaveTextContent("false");
  });

  it("queues Loops and Effects while globally paused and starts them only on resume", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Pause all" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Loop" }));
      fireEvent.click(screen.getByRole("button", { name: "Shot" }));
    });
    const [loop, shot] = FakeAudio.instances;
    expect(loop.play).not.toHaveBeenCalled();
    expect(shot.play).not.toHaveBeenCalled();
    expect(screen.getByLabelText("playback status")).toHaveTextContent("paused:paused:paused");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Triggered shot" })));
    expect(FakeAudio.instances).toHaveLength(2);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resume all" })));
    expect(loop.play).toHaveBeenCalledOnce();
    expect(shot.play).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("playback status")).toHaveTextContent("running:playing:playing");
  });

  it("pauses only Music, queues new Music, and keeps other sounds running", async () => {
    render(<AudioPlaybackProvider><Harness /><MusicHarness /></AudioPlaybackProvider>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Loop" }));
      fireEvent.click(screen.getByRole("button", { name: "First track" }));
    });
    const [ambience, first] = FakeAudio.instances;
    fireEvent.click(screen.getByRole("button", { name: "Pause music" }));
    expect(first.pause).toHaveBeenCalledOnce();
    expect(ambience.pause).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Other group track" })));
    const queued = FakeAudio.instances[2];
    expect(queued.play).not.toHaveBeenCalled();
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:paused");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Shot" })));
    expect(FakeAudio.instances[3].play).toHaveBeenCalledOnce();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resume music" })));
    expect(queued.play).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:playing");
    expect(ambience.play).toHaveBeenCalledOnce();
  });

  it("plays only one music-group cue and wraps the playlist when repeat is enabled", async () => {
    render(<AudioPlaybackProvider><MusicHarness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "First track" })));
    const first = FakeAudio.instances[0];
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Second track" })));
    expect(first.pause).toHaveBeenCalledOnce();
    const second = FakeAudio.instances[1];
    act(() => second.dispatchEvent(new Event("ended")));
    expect(FakeAudio.instances[2]?.src).toBe("first.mp3");
    expect(FakeAudio.instances[2]?.play).toHaveBeenCalledOnce();
  });

  it("does not advance when group Repeat is disabled during the current track", async () => {
    render(<AudioPlaybackProvider><MusicHarness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "First track" })));
    fireEvent.click(screen.getByRole("button", { name: "Toggle playlist repeat" }));
    act(() => FakeAudio.instances[0].dispatchEvent(new Event("ended")));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:idle");
  });

  it("enables advancement live and stops after the next track if Repeat is disabled again", async () => {
    render(<AudioPlaybackProvider><MusicHarness /></AudioPlaybackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Toggle playlist repeat" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "First track" })));
    fireEvent.click(screen.getByRole("button", { name: "Toggle playlist repeat" }));
    act(() => FakeAudio.instances[0].dispatchEvent(new Event("ended")));
    expect(FakeAudio.instances[1].src).toBe("second.mp3");
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Toggle playlist repeat" }));
    act(() => FakeAudio.instances[1].dispatchEvent(new Event("ended")));
    expect(FakeAudio.instances).toHaveLength(2);
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:idle");
  });

  it("switches Music groups without stopping ambience or resuming the previous playlist", async () => {
    render(<AudioPlaybackProvider><Harness /><MusicHarness /></AudioPlaybackProvider>);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Loop" }));
      fireEvent.click(screen.getByRole("button", { name: "First track" }));
    });
    const [ambience, first] = FakeAudio.instances;
    first.currentTime = 25;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Other group track" })));
    const other = FakeAudio.instances[2];
    expect(first.pause).toHaveBeenCalledOnce();
    expect(first.currentTime).toBe(0);
    expect(ambience.pause).not.toHaveBeenCalled();
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:playing");
    act(() => first.dispatchEvent(new Event("ended")));
    expect(FakeAudio.instances).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Pause all" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resume all" })));
    expect(first.play).toHaveBeenCalledOnce();
    expect(other.play).toHaveBeenCalledTimes(2);
    expect(ambience.play).toHaveBeenCalledTimes(2);
    act(() => other.dispatchEvent(new Event("ended")));
    expect(screen.getByLabelText("music status")).toHaveTextContent("idle:idle");
    expect(FakeAudio.instances).toHaveLength(3);
  });
});
