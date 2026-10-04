/** Progress is sequential; the ring is a read-only SVG representation. */
export function ClockRing({ name, value, segments }: { name: string; value: number; segments: number }) {
  const angle = 2 * Math.PI / segments;
  const point = (r: number, a: number) => `${24 + r * Math.sin(a)},${24 - r * Math.cos(a)}`;
  return <svg aria-label={`${name}: ${value} of ${segments} segments filled`} role="img" width="48" height="48" viewBox="0 0 48 48">
    {segments === 1 ? <circle cx="24" cy="24" r="20" fill={value ? "currentColor" : "none"} stroke="currentColor" /> :
      Array.from({ length: segments }, (_, index) => {
        const start = index * angle + 0.025;
        const end = (index + 1) * angle - 0.025;
        return <path key={index} d={`M ${point(20, start)} A 20 20 0 0 1 ${point(20, end)} L ${point(8, end)} A 8 8 0 0 0 ${point(8, start)} Z`}
          fill={index < value ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1" />;
      })}
  </svg>;
}
