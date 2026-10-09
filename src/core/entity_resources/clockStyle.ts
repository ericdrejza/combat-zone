export type ClockStyle = "traditional" | "box" | "stack" | "row";
export const DEFAULT_CLOCK_STYLE: ClockStyle = "traditional";
export function isClockStyle(value: unknown): value is ClockStyle {
  return value === "traditional" || value === "box" || value === "stack" || value === "row";
}
