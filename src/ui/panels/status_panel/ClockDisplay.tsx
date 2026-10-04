import type { ClockStyle } from "@entities/zone/clockStyle";
import { ClockLinear } from "./ClockLinear";
import { ClockRing } from "./ClockRing";

/** Visual choice changes the representation of progress, never its mechanics. */
export function ClockDisplay({ style = "traditional", ...progress }: { style?: ClockStyle; name: string; value: number; segments: number }) {
  return style === "linear" ? <ClockLinear {...progress} /> : <ClockRing {...progress} />;
}
