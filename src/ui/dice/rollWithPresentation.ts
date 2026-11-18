import type { DiceResult } from "@core/dice/types";
import { readDicePresentation } from "./dicePreferences";
import { getDiceTray } from "./diceTrayBridge";
/** A failed visual attempt is discarded as a whole; only one complete outcome is committed. */
export async function rollWithPresentation(formulas: string[], signal: AbortSignal, text: (formulas: string[], signal?: AbortSignal) => Promise<DiceResult[]>) {
  if (readDicePresentation() !== "3d" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return text(formulas, signal);
  try {
    const tray = getDiceTray();
    if (!tray) throw new Error("3D tray is unavailable in this window.");
    return await tray(formulas, signal);
  } catch (error) {
    if (signal.aborted) throw error;
    const results = await text(formulas, signal);
    const reason = error instanceof Error ? error.message : "3D presentation is unavailable.";
    return results.map(result => ({ ...result, presentationNote: `Text fallback: ${reason}` }));
  }
}
