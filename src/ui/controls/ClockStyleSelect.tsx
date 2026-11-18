import { isClockStyle, type ClockStyle } from "@core/entity_resources/clockStyle";

/** Shared choices for a clock draft and the durable new-clock default. */
export function ClockStyleSelect({ label, value, onChange }: { label: string; value: ClockStyle; onChange: (style: ClockStyle) => void }) {
  return <label className="block text-sm">
    {label}
    <select aria-label={label} value={value} className="mt-1 block w-full rounded-xl border border-canvas-line bg-canvas-surface px-3 py-2 text-sm enabled:hover:border-canvas-ink focus-visible:ring-2 focus-visible:ring-canvas-ink"
      onChange={(event) => { if (isClockStyle(event.currentTarget.value)) onChange(event.currentTarget.value); }}>
      <option value="box">Box</option>
      <option value="row">Row</option>
      <option value="stack">Stack</option>
      <option value="traditional">Traditional</option>
    </select>
  </label>;
}
