/** Each SVG box represents one segment; flex wrapping uses the available row width. */
export function ClockLinear({ name, value, segments }: { name: string; value: number; segments: number }) {
  return <div aria-label={`${name}: ${value} of ${segments} segments filled`} role="img" className="flex min-w-0 max-w-full flex-1 flex-wrap justify-center gap-0.5">
    {Array.from({ length: segments }, (_, index) => <svg aria-hidden="true" key={index} width="12" height="12" viewBox="0 0 16 16" className="shrink-0">
      <rect x="1" y="1" width="14" height="14" rx="1" fill={index < value ? "currentColor" : "none"} stroke="currentColor" />
    </svg>)}
  </div>;
}
