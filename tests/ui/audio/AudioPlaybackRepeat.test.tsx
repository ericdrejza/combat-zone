import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioCue } from "@entities/audio/types";
import { AudioPlaybackProvider, useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";

vi.mock("@ui/interface_preferences/InterfacePreferenceProvider", () => ({
  useInterfacePreferences: () => ({ audioMasterVolume: 0.5 })
}));

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  loop = false;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  volume = 1;
  constructor(readonly src: string) {
    super();
    FakeAudio.instances.push(this);
  }
}

const effect: AudioCue = {
  id: "effect", libraryNodeId: "effect-node", placement: { type: "group", groupId: "ambience" },
  repeat: true, repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 5 },
  triggers: [], type: "one_shot", volume: 0.5
};

function Harness() {
  const playback = useAudioPlayback();
  const [cue, setCue] = useState(effect);
  useEffect(() => playback.registerCueSource(cue, "effect.mp3"), [cue, playback.registerCueSource]);
  return <>
    <button onClick={() => playback.playRegistered(cue.id)}>Play</button>
    <button onClick={() => playback.playRegistered(cue.id, `trigger-${FakeAudio.instances.length}`)}>Trigger</button>
    <button onClick={() => setCue((current) => ({ ...current, repeat: !current.repeat }))}>Toggle repeat</button>
    <button onClick={playback.pauseAll}>Pause</button>
    <button onClick={playback.resumeAll}>Resume</button>
    <output aria-label="status">{playback.getStatus(cue.id)}</output>
  </>;
}

describe("live Effect repeat configuration", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("lets the current sound finish once when repeat is disabled", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByText("Play")));
    const audio = FakeAudio.instances[0];
    audio.currentTime = 2;
    fireEvent.click(screen.getByText("Toggle repeat"));
    expect(screen.getByLabelText("status")).toHaveTextContent("playing");
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.currentTime).toBe(2);
    act(() => audio.dispatchEvent(new Event("ended")));
    expect(screen.getByLabelText("status")).toHaveTextContent("idle");
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it.each([false, true])("cancels a pending repeat, including paused waits (paused=%s)", async (paused) => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByText("Play")));
    const audio = FakeAudio.instances[0];
    act(() => audio.dispatchEvent(new Event("ended")));
    expect(screen.getByLabelText("status")).toHaveTextContent("waiting");
    if (paused) fireEvent.click(screen.getByText("Pause"));
    fireEvent.click(screen.getByText("Toggle repeat"));
    expect(screen.getByLabelText("status")).toHaveTextContent("idle");
    if (paused) fireEvent.click(screen.getByText("Resume"));
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("cancels waiting trigger instances while letting an overlapping sound finish", async () => {
    render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    await act(async () => {
      fireEvent.click(screen.getByText("Trigger"));
      fireEvent.click(screen.getByText("Trigger"));
    });
    const [waiting, playing] = FakeAudio.instances;
    act(() => waiting.dispatchEvent(new Event("ended")));
    fireEvent.click(screen.getByText("Toggle repeat"));
    expect(waiting.pause).toHaveBeenCalledOnce();
    expect(playing.pause).not.toHaveBeenCalled();
    expect(screen.getByLabelText("status")).toHaveTextContent("playing");
    act(() => playing.dispatchEvent(new Event("ended")));
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(screen.getByLabelText("status")).toHaveTextContent("idle");
    expect(waiting.play).toHaveBeenCalledOnce();
    expect(playing.play).toHaveBeenCalledOnce();
  });
});
