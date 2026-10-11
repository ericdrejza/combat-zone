import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioCue, AudioCueGroupSection } from "@entities/audio/types";
import { AudioPlaybackProvider, useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";
import { TrackPlaybackControls } from "@ui/audio/TrackPlaybackControls";
import { GroupPlaybackButton } from "@ui/audio/AudioTransportControls";

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  loop = false;
  volume = 1;
  pause = vi.fn();
  play = vi.fn(async () => undefined);
  constructor(readonly src: string) { super(); FakeAudio.instances.push(this); }
}

function PauseAllButton() {
  const playback = useAudioPlayback();
  return <button onClick={playback.pauseAll}>Pause everything</button>;
}

function Harness({ section }: { section: AudioCueGroupSection }) {
  const playback = useAudioPlayback();
  useEffect(() => {
    const cue = (id: string): AudioCue => ({ id, libraryNodeId: id, placement: { type: "group", groupId: "group" }, type: "track", repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 }, triggers: [], triggersEnabled: false, volume: 0.5 });
    const cleanups = ["first", "second"].map((id) => playback.registerCueSource(cue(id), `${id}.mp3`));
    playback.setAudioGroupSections([{ id: "group", section }]);
    if (section === "music") playback.setMusicGroups([{ groupId: "group", cueIds: ["first", "second"], repeat: true }]);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [playback.registerCueSource, playback.setAudioGroupSections, playback.setMusicGroups, section]);
  return <GroupPlaybackButton cueIds={["first", "second"]} groupId="group" label="Test group" section={section} />;
}

describe("group playback control", () => {
  beforeEach(() => { FakeAudio.instances = []; vi.stubGlobal("Audio", FakeAudio); });
  afterEach(() => vi.unstubAllGlobals());
  it("places Stop before Play/Pause and retains track timing until stopped", async () => {
    const cue: AudioCue = { id: "track", libraryNodeId: "track", placement: { type: "group", groupId: "group" }, type: "track", repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 }, triggers: [], triggersEnabled: false, volume: 0.5 };
    render(<AudioPlaybackProvider><TrackPlaybackControls cue={cue} name="Track" sourceUrl="track.mp3" /></AudioPlaybackProvider>);
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["Stop Track", "Play Track"]);
    expect(screen.getByRole("button", { name: "Stop Track" })).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play Track" })));
    const audio = FakeAudio.instances[0];
    audio.currentTime = 19;
    fireEvent.click(screen.getByRole("button", { name: "Pause Track" }));
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(19);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play Track" })));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio.play).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(19);
    fireEvent.click(screen.getByRole("button", { name: "Stop Track" }));
    expect(audio.currentTime).toBe(0);
    expect(screen.getByRole("button", { name: "Stop Track" })).toBeDisabled();
  });
  it("resumes just one track while its section remains paused", async () => {
    const cue = (id: string): AudioCue => ({ id, libraryNodeId: id, placement: { type: "group", groupId: "group" }, type: "track", repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 }, triggers: [], triggersEnabled: false, volume: 0.5 });
    render(<AudioPlaybackProvider>
      <TrackPlaybackControls cue={cue("first")} name="First" sourceUrl="first.mp3" />
      <TrackPlaybackControls cue={cue("second")} name="Second" sourceUrl="second.mp3" />
      <PauseAllButton />
    </AudioPlaybackProvider>);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play First" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play Second" })));
    FakeAudio.instances[0].currentTime = 9;
    fireEvent.click(screen.getByRole("button", { name: "Pause everything" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play First" })));
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(2);
    expect(FakeAudio.instances[0].currentTime).toBe(9);
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Play Second" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause First" })).toBeInTheDocument();
  });
  it.each(["ambiance", "music"] as const)("starts idle %s groups and preserves playback on pause/resume", async (section) => {
    render(<AudioPlaybackProvider><Harness section={section} /><PauseAllButton /></AudioPlaybackProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Pause everything" }));
    expect(screen.getByRole("button", { name: "Play Test group" })).toBeEnabled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Play Test group" })));
    expect(FakeAudio.instances.map((audio) => audio.src)).toEqual(section === "music" ? ["first.mp3"] : ["first.mp3", "second.mp3"]);
    FakeAudio.instances[0].currentTime = 8;
    fireEvent.click(screen.getByRole("button", { name: "Pause Test group" }));
    expect(FakeAudio.instances[0].pause).toHaveBeenCalledOnce();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Resume Test group" })));
    expect(FakeAudio.instances[0].currentTime).toBe(8);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(2);
  });
});
