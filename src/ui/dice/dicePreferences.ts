import { useEffect, useState } from "react";
export type DicePresentation = "text" | "images" | "3d";
export const DICE_PREFERENCES_KEY = "combat-zone.dice-presentation";
const EVENT = "combat-zone:dice-preferences";
export function readDicePresentation(): DicePresentation {
  try { const saved = localStorage.getItem(DICE_PREFERENCES_KEY); return saved === "images" || saved === "3d" ? saved : "text"; } catch { return "text"; }
}
export function saveDicePresentation(value: DicePresentation) {
  try { localStorage.setItem(DICE_PREFERENCES_KEY, value); } catch { /* Current-tab preference remains usable. */ }
  window.dispatchEvent(new Event(EVENT));
}
export function useDicePresentation() {
  const [mode, setMode] = useState(readDicePresentation);
  useEffect(() => {
    const update = () => setMode(readDicePresentation());
    window.addEventListener(EVENT, update); window.addEventListener("storage", update); window.addEventListener("combat-zone:preferences-reset", update);
    return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); window.removeEventListener("combat-zone:preferences-reset", update); };
  }, []);
  return mode;
}
