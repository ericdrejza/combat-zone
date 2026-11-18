/** The main window owns launch dialogs even when Log is collapsed; isolated panel tests use the fallback. */
export const newlyPendingRolls = new Set<string>();
let host: ((id: string) => void) | null = null;
export function registerResolutionHost(open: (id: string) => void) { host = open; return () => { if (host === open) host = null; }; }
export function requestRollResolution(id: string) { if (host) host(id); else newlyPendingRolls.add(id); }
