type Props = { name: string; directCount: number; totalCount: number; onChoose: (recursive: boolean) => void; onCancel: () => void };

/** One recursion decision applies to the entire cue assignment batch. */
export function AudioDirectoryDialog({ name, directCount, totalCount, onChoose, onCancel }: Props) {
  return <div className="viewport-overlay z-[80] flex items-center justify-center bg-black/40 p-4">
    <div aria-label="Include audio subdirectories" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-canvas-panel p-5 shadow-xl" role="dialog">
      <h3 className="font-display text-lg font-semibold">Add cues from {name}</h3>
      <p className="mt-2 text-sm text-canvas-muted">Would you like to include cues from all subdirectories?</p>
      <div className="mt-4 flex flex-col gap-2">
        <button className="rounded-xl border border-canvas-line p-3 hover:bg-canvas disabled:opacity-50" disabled={!directCount} onClick={() => onChoose(false)} type="button">This directory only ({directCount} cues)</button>
        <button className="rounded-xl border border-canvas-line p-3 hover:bg-canvas disabled:opacity-50" disabled={!totalCount} onClick={() => onChoose(true)} type="button">Include all subdirectories ({totalCount} cues)</button>
        <button onClick={onCancel} type="button">Cancel</button>
      </div>
    </div>
  </div>;
}
