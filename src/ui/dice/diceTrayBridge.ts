import type { DiceResult } from "@core/dice/types";
export type TrayRoller = (formulas: string[], signal: AbortSignal) => Promise<DiceResult[]>;
let tray: TrayRoller | null = null;
export function registerDiceTray(roller: TrayRoller) { tray = roller; return () => { if (tray === roller) tray = null; }; }
export function getDiceTray() { return tray; }
