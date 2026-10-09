/** Segments fill left to right in a four-column grid, including partial rows. */
export function ClockBox({ name, value, segments }: { name: string; value: number; segments: number }) {
  return <div aria-label={`${name}: ${value} of ${segments} segments filled`} role="img" className="grid w-full min-w-0 grid-cols-[repeat(4,12px)] content-center justify-center justify-items-start gap-1">
    {Array.from({ length: segments }, (_, index) => <svg aria-hidden="true" key={index} width="12" height="12" viewBox="0 0 16 16" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="1" fill={index < value ? "currentColor" : "none"} stroke="currentColor" />
    </svg>)}
  </div>;
}
