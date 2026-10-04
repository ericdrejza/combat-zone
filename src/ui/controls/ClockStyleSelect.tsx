import { isClockStyle, type ClockStyle } from "@entities/zone/clockStyle";

/** Shared choices for a clock draft and the durable new-clock default. */
export function ClockStyleSelect({ label, value, onChange }: { label: string; value: ClockStyle; onChange: (style: ClockStyle) => void }) {
  return <label className="flex min-h-12 items-center justify-between gap-4 py-3">
    <span className="text-sm">{label}</span>
    <select aria-label={label} value={value} className="rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm enabled:hover:border-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink"
      onChange={(event) => { if (isClockStyle(event.currentTarget.value)) onChange(event.currentTarget.value); }}>
      <option value="traditional">Traditional</option>
      <option value="linear">Linear</option>
    </select>
  </label>;
}
