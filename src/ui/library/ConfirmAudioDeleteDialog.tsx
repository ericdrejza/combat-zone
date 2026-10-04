import type { LibraryNode } from "@library/types";

export function ConfirmAudioDeleteDialog({ node, cueCount, linkCount, onCancel, onDelete }: { node: LibraryNode; cueCount: number; linkCount: number; onCancel: () => void; onDelete: () => void }) {
  return <div aria-label="Confirm audio deletion" aria-modal="true" className="viewport-overlay z-[85] flex items-center justify-center bg-black/30 p-6" role="dialog">
    <div className="w-full max-w-sm rounded-2xl border border-canvas-line bg-canvas-panel p-5 shadow-xl">
      <h3 className="font-display text-lg font-semibold">Delete {node.name}?</h3>
      {node.type === "folder" ? <p className="mt-2 text-sm">This also deletes everything inside this directory.</p> : null}
      <p className="mt-2 text-sm text-canvas-muted">This source is used by {cueCount} sound {cueCount === 1 ? "cue" : "cues"} across the current and saved encounters and {linkCount} linked {linkCount === 1 ? "asset" : "assets"}. Affected cues and surviving links will need a new source.</p>
      <div className="mt-5 flex justify-end gap-2"><button className="rounded-xl border border-canvas-line px-4 py-2" onClick={onCancel} type="button">Cancel</button><button className="rounded-xl bg-red-700 px-4 py-2 text-white" onClick={onDelete} type="button">Delete</button></div>
    </div>
  </div>;
}
