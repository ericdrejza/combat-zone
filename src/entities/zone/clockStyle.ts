export type ClockStyle = "traditional" | "linear";
export const DEFAULT_CLOCK_STYLE: ClockStyle = "traditional";
export function isClockStyle(value: unknown): value is ClockStyle {
  return value === "traditional" || value === "linear";
}
