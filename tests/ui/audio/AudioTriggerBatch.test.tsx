import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AudioCue } from "@entities/audio/types";
import { AudioPlaybackProvider, useAudioPlayback } from "@ui/audio/AudioPlaybackProvider";

const preferences = vi.hoisted(() => ({ audioMasterVolume: 0.5, audioMediaKeyScope: "music" }));
vi.mock("@ui/interface_preferences/InterfacePreferenceProvider", () => ({ useInterfacePreferences: () => preferences }));

class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  static rejectNext: ((reason: Error) => void) | null = null;
  static deferNext = false;
  currentTime = 0;
  duration = 120;
  loop = false;
  volume = 1;
  pause = vi.fn();
  play = vi.fn(() => {
    if (!FakeAudio.deferNext) return Promise.resolve();
    FakeAudio.deferNext = false;
    return new Promise<void>((_resolve, reject) => { FakeAudio.rejectNext = reject; });
  });
  constructor(readonly src: string) { super(); FakeAudio.instances.push(this); }
}

const zoneCue: AudioCue = {
  id: "zone", libraryNodeId: "asset", placement: { type: "group", groupId: "zone-group" },
  repeat: false, repeatDelay: { minimumDelaySeconds: 0, maximumDelaySeconds: 0 },
  triggers: ["zone_enter", "zone_leave"], triggersEnabled: true, type: "one_shot", volume: 0.2
};
const actorCue: AudioCue = { ...zoneCue, id: "actor", libraryNodeId: "linked-asset", placement: { type: "group", groupId: "actor-group" }, triggers: ["actor_enter_zone"], volume: 0.8 };
// Distinct Library assets remain distinct even if their source URLs match.
const otherCue: AudioCue = { ...actorCue, id: "other", libraryNodeId: "other-asset" };
let sequence = 0;

function Harness() {
  const playback = useAudioPlayback();
  const [actor, setActor] = useState(actorCue);
  useEffect(() => {
    const unregister = [zoneCue, actor, otherCue].map((cue) => playback.registerCueSource(cue, "sound.mp3", cue.id === "other" ? "other-asset" : "asset"));
    playback.setAudioGroupSections([{ id: "zone-group", section: "zone" }, { id: "actor-group", section: "actor" }]);
    return () => unregister.forEach((cleanup) => cleanup());
  }, [actor, playback.registerCueSource, playback.setAudioGroupSections]);
  const trigger = (ids: string[]) => playback.playTriggeredBatch(ids.map((cueId) => ({ cueId, instanceId: `movement-${++sequence}` })));
  return <>
    <button onClick={() => trigger(["zone", "actor"])}>Trigger both</button>
    <button onClick={() => trigger(["zone", "zone", "actor"])}>Trigger duplicate events</button>
    <button onClick={() => trigger(["zone", "actor", "other"])}>Trigger all</button>
    <button onClick={() => void playback.play(zoneCue, "sound.mp3")}>Manual play</button>
    <button onClick={() => playback.stop("zone")}>Stop zone cue</button>
    <button onClick={() => playback.stop("actor")}>Stop actor cue</button>
    <button onClick={playback.stopAll}>Stop all</button>
    <button onClick={() => playback.pauseSection("zone")}>Pause zones</button>
    <button onClick={playback.pauseAll}>Pause all</button>
    <button onClick={() => playback.setCueVolume("zone", 0.9)}>Raise zone volume</button>
    <button onClick={() => playback.setCueVolume("actor", 0.1)}>Lower actor volume</button>
    <button onClick={() => setActor({ ...actor, repeat: true, triggersEnabled: false, repeatDelay: { minimumDelaySeconds: 5, maximumDelaySeconds: 5 } })}>Enable actor repeat</button>
    {[zoneCue, actorCue, otherCue].map((cue) => <output aria-label={`${cue.id} status`} key={cue.id}>{playback.getStatus(cue.id)}:{playback.getProgress(cue.id).currentTime}</output>)}
  </>;
}

function setup() { return render(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>); }
const status = (id: string, value: string) => expect(screen.getByLabelText(`${id} status`)).toHaveTextContent(value);
const click = async (name: string) => act(async () => fireEvent.click(screen.getByText(name)));

describe("movement trigger batch playback", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.rejectNext = null;
    FakeAudio.deferNext = false;
    sequence = 0;
    preferences.audioMasterVolume = 0.5;
    vi.stubGlobal("Audio", FakeAudio);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("plays linked cues once, at the highest volume, and synchronizes progress and completion", async () => {
    setup();
    await click("Trigger duplicate events");
    expect(FakeAudio.instances).toHaveLength(1);
    const audio = FakeAudio.instances[0];
    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.volume).toBe(0.4);
    audio.currentTime = 5;
    act(() => audio.dispatchEvent(new Event("timeupdate")));
    status("zone", "playing:5");
    status("actor", "playing:5");
    act(() => audio.dispatchEvent(new Event("ended")));
    status("zone", "idle:0");
    status("actor", "idle:0");
  });

  it("keeps different assets and later movements independent, including manual playback", async () => {
    setup();
    await click("Manual play");
    await click("Trigger all");
    expect(FakeAudio.instances).toHaveLength(3);
    await click("Trigger both");
    expect(FakeAudio.instances).toHaveLength(4);
    act(() => FakeAudio.instances[1].dispatchEvent(new Event("ended")));
    status("zone", "playing");
    status("actor", "playing");
    status("other", "playing");
  });

  it.each(["zone", "actor"])("stops the shared sound from the %s card without stopping unrelated assets", async (cueId) => {
    setup();
    await click("Trigger all");
    const [shared, other] = FakeAudio.instances;
    shared.currentTime = 4;
    await click(`Stop ${cueId} cue`);
    expect(shared.pause).toHaveBeenCalledOnce();
    expect(shared.currentTime).toBe(0);
    expect(other.pause).not.toHaveBeenCalled();
    status("zone", "idle");
    status("actor", "idle");
    status("other", "playing");
    await click("Stop all");
    expect(other.pause).toHaveBeenCalledOnce();
  });

  it("respects paused sections when choosing participating cues and maximum volume", async () => {
    setup();
    await click("Pause zones");
    await click("Trigger both");
    expect(FakeAudio.instances).toHaveLength(1);
    status("zone", "idle");
    status("actor", "playing");
    await click("Pause all");
    status("actor", "idle");
    await click("Trigger both");
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it("recalculates the shared maximum for cue and master-volume changes", async () => {
    const view = setup();
    await click("Trigger both");
    const audio = FakeAudio.instances[0];
    await click("Lower actor volume");
    expect(audio.volume).toBe(0.1);
    await click("Raise zone volume");
    expect(audio.volume).toBe(0.45);
    preferences.audioMasterVolume = 0.2;
    view.rerender(<AudioPlaybackProvider><Harness /></AudioPlaybackProvider>);
    expect(audio.volume).toBeCloseTo(0.18);
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("clears all participants on playback failure and ignores a stopped batch's late rejection", async () => {
    setup();
    FakeAudio.deferNext = true;
    await click("Trigger both");
    const reject = FakeAudio.rejectNext!;
    await click("Stop zone cue");
    await click("Trigger both");
    await act(async () => reject(new Error("interrupted")));
    status("zone", "playing");
    status("actor", "playing");
    act(() => FakeAudio.instances[1].dispatchEvent(new Event("error")));
    status("zone", "idle");
    status("actor", "idle");
  });

  it("preserves live repeat changes after the original shared sound finishes", async () => {
    vi.useFakeTimers();
    setup();
    await click("Trigger both");
    await click("Enable actor repeat");
    expect(FakeAudio.instances).toHaveLength(1);
    act(() => FakeAudio.instances[0].dispatchEvent(new Event("ended")));
    status("zone", "idle");
    status("actor", "waiting");
    expect(FakeAudio.instances).toHaveLength(2);
    expect(FakeAudio.instances[1].play).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    status("actor", "playing");
    expect(FakeAudio.instances[1].play).toHaveBeenCalledOnce();
    await click("Stop all");
  });
});
