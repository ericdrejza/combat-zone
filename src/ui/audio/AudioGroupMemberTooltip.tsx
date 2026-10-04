/** Shared member-name presentation for Soundboard summaries and panel count pills. */
export function AudioGroupMemberTooltip({ id, names }: { id: string; names: readonly string[] }) {
  return <span className="absolute right-0 top-6 z-50 w-max max-w-72 rounded-lg bg-canvas-ink px-3 py-2 text-xs text-canvas-on-ink shadow-lg" id={id} role="tooltip">
    {names.length ? names.map((name, index) => <span className="block" key={index}>{name}</span>) : "No members."}
  </span>;
}
