import { useState } from "react";

import { getDefaultAudioCueGroupName } from "@entities/audio/audioGroupNames";
import type { AudioCueGroupSection } from "@entities/audio/types";

/** Naming is a draft; only Create commits the group and its cue together. */
export function AudioGroupNameDialog({ onBack, onCreate, section }: { onBack: () => void; onCreate: (name: string) => void; section: AudioCueGroupSection }) {
  const [name, setName] = useState("");
  const defaultName = getDefaultAudioCueGroupName(section);
  return <div className="viewport-overlay z-[80] flex items-center justify-center bg-black/40 p-4">
    <form aria-label="Name new cue group" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-canvas-panel p-5 shadow-xl" onSubmit={(event) => { event.preventDefault(); onCreate(name); }} role="dialog">
      <h3 className="font-display text-lg font-semibold">Name new cue group</h3>
      <label className="mt-4 block text-sm font-semibold">Group name
        <input autoFocus className="mt-2 w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 font-normal" onChange={(event) => setName(event.currentTarget.value)} placeholder={defaultName} type="text" value={name} />
      </label>
      <div className="mt-4 flex justify-end gap-3">
        <button className="rounded-xl border border-canvas-line px-3 py-2 hover:bg-canvas" onClick={onBack} type="button">Back</button>
        <button className="rounded-xl bg-canvas-ink px-3 py-2 text-canvas-on-ink" type="submit">Create</button>
      </div>
    </form>
  </div>;
}
