import { ignoreShortcut } from "@ui/keybinds/keyboardGuards";
import { ContactRound, X } from "lucide-react";
import { createContext, useContext, useEffect, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import { matchesKeybind, useKeybinds } from "@ui/keybinds";
import { usePanelPopout } from "@hooks/usePanelPopout";
import { InitiativePanel } from "@ui/panels/InitiativePanel";

const InitiativePopoutContext = createContext({ initiativeOpen: false, openInitiative: () => {} });

/** Shares the application store with a session-only, browser-owned window. */
export function InitiativePopoutProvider({ children }: PropsWithChildren) {
  const { popup, root, open: openInitiative, close, toggle: toggleInitiative } = usePanelPopout("initiative", "Initiative");
  const { bindings } = useKeybinds();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (ignoreShortcut(event) || event.repeat || target?.closest?.("input,textarea,select,[contenteditable='true']")) return;
      if (!matchesKeybind(event, bindings["initiative.toggle"])) return;
      event.preventDefault();
      toggleInitiative();
    };
    window.addEventListener("keydown", handleKeyDown);
    popup?.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      popup?.removeEventListener("keydown", handleKeyDown);
    };
  }, [bindings, popup, toggleInitiative]);

  return <InitiativePopoutContext.Provider value={{ initiativeOpen: Boolean(popup), openInitiative }}>
    {children}
    {root ? createPortal(<main className="h-dvh w-screen overflow-auto bg-canvas-panel text-canvas-ink">
      <div className="min-h-full min-w-[20rem] p-4">
      <header className="mb-4 flex items-center gap-2"><ContactRound aria-hidden="true" className="h-5 w-5" /><h1 className="mr-auto font-display text-xl font-semibold">Initiative</h1><button aria-label="Close Initiative window" className="rounded-full border border-canvas-line p-2" onClick={close} title="Close Initiative window" type="button"><X aria-hidden="true" className="h-4 w-4" /></button></header>
      <InitiativePanel isPopout />
      </div>
    </main>, root) : null}
  </InitiativePopoutContext.Provider>;
}

export function useInitiativePopout() { return useContext(InitiativePopoutContext); }
