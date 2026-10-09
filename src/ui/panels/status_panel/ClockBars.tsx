/** Bars use the available axis without changing the shared card dimensions. */
export function ClockBars({ name, value, segments, style }: { name: string; value: number; segments: number; style: "stack" | "row" }) {
  const vertical = style === "stack";
  const extent = 48;
  const thickness = (extent - (segments - 1)) / segments;
  return <svg aria-label={`${name}: ${value} of ${segments} segments filled`} role="img" width="48" height={vertical ? 48 : 24} viewBox={`0 0 48 ${vertical ? 48 : 24}`} preserveAspectRatio="none" className={vertical ? "shrink-0" : "h-6 w-full min-w-0"}>
    {Array.from({ length: segments }, (_, index) => {
      const position = (vertical ? segments - 1 - index : index) * (thickness + 1) + 0.25;
      return <rect key={index} x={vertical ? 4 : position} y={vertical ? position : 4} width={vertical ? 40 : thickness - 0.5} height={vertical ? thickness - 0.5 : 16} rx="0.25"
        fill={index < value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="0.5" />;
    })}
  </svg>;
}
