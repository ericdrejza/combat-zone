import { ignoreShortcut } from "@ui/keybinds/keyboardGuards";
import { ContactRound, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { createPortal } from "react-dom";

import { matchesKeybind, useKeybinds } from "@ui/keybinds";
import { useTheme } from "@ui/theme/ThemeProvider";
import { InitiativePanel } from "@ui/panels/InitiativePanel";

const InitiativePopoutContext = createContext({ initiativeOpen: false, openInitiative: () => {} });

/** Shares the application store with a session-only, browser-owned window. */
export function InitiativePopoutProvider({ children }: PropsWithChildren) {
  const [popup, setPopup] = useState<Window | null>(null);
  const popupRef = useRef<Window | null>(null);
  const { bindings } = useKeybinds();
  const { theme } = useTheme();

  const close = useCallback(() => {
    const previous = popupRef.current;
    popupRef.current = null;
    setPopup(null);
    if (previous && !previous.closed) previous.close();
  }, []);

  const openInitiative = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) { popupRef.current.focus(); return; }
    const next = window.open("", "combat-zone-initiative", "popup,width=420,height=720,toolbar=no,location=no,menubar=no");
    if (!next) { window.alert("The Initiative popup was blocked. Allow popups for this site and try again."); return; }
    next.document.title = "Combat Zone Initiative";
    const root = next.document.createElement("div");
    root.id = "initiative-root";
    next.document.body.replaceChildren(root);
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => next.document.head.append(node.cloneNode(true)));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", "initiative");
      next.history.replaceState(null, "", url.href);
    } catch { /* Browser owns the popup's location chrome. */ }
    next.addEventListener("beforeunload", () => {
      if (popupRef.current === next) { popupRef.current = null; setPopup(null); }
    }, { once: true });
    popupRef.current = next;
    setPopup(next);
  }, []);

  const toggleInitiative = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) close();
    else openInitiative();
  }, [close, openInitiative]);

  useEffect(() => {
    if (!popup || popup.closed) return;
    popup.document.documentElement.classList.toggle("dark", theme === "dark");
    popup.document.documentElement.dataset.theme = theme;
  }, [popup, theme]);

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

  useEffect(() => {
    window.addEventListener("beforeunload", close);
    return () => { window.removeEventListener("beforeunload", close); popupRef.current?.close(); };
  }, [close]);

  const root = popup?.document.getElementById("initiative-root");
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
