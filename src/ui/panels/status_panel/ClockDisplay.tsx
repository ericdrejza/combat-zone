import type { ClockStyle } from "@core/entity_resources/clockStyle";
import { ClockBox } from "./ClockBox";
import { ClockBars } from "./ClockBars";
import { ClockRing } from "./ClockRing";

/** Visual choice changes the representation of progress, never its mechanics. */
export function ClockDisplay({ style = "traditional", ...progress }: { style?: ClockStyle; name: string; value: number; segments: number }) {
  if (style === "stack" || style === "row") return <ClockBars style={style} {...progress} />;
  return style === "box" ? <ClockBox {...progress} /> : <ClockRing {...progress} />;
}
