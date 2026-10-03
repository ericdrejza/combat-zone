import { createPortal } from "react-dom";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useTheme } from "@ui/theme/ThemeProvider";
import { Soundboard } from "./Soundboard";

type Value = { soundboardOpen: boolean; openSoundboard: () => void };
const SoundboardContext = createContext<Value | null>(null);

export function SoundboardProvider({ children }: PropsWithChildren) {
  const [modalOpen, setModalOpen] = useState(false);
  const [popup, setPopup] = useState<Window | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!popup || popup.closed) return;
    popup.document.documentElement.classList.toggle("dark", theme === "dark");
    popup.document.documentElement.dataset.theme = theme;
  }, [popup, theme]);

  const createPopup = useCallback(() => {
    const next = window.open("", "combat-zone-soundboard", "popup,width=1000,height=720,toolbar=no,location=no,menubar=no");
    if (!next) { window.alert("The Soundboard popup was blocked. Allow popups for this site and try again."); return; }
    next.document.title = "Combat Zone Soundboard";
    next.document.body.innerHTML = '<div id="soundboard-root"></div>';
    next.document.documentElement.classList.toggle("dark", theme === "dark");
    next.document.documentElement.dataset.theme = theme;
    try { const url = new URL(window.location.href); url.searchParams.set("view", "soundboard"); next.history.replaceState(null, "", url.href); } catch { /* Origin chrome is browser-owned. */ }
    document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => next.document.head.append(node.cloneNode(true)));
    next.addEventListener("beforeunload", () => setPopup(null), { once: true });
    setPopup(next);
    setModalOpen(false);
  }, [theme]);

  const popIn = useCallback(() => {
    if (popup && !popup.closed) popup.close();
    setPopup(null);
    setModalOpen(true);
  }, [popup]);

  const openSoundboard = useCallback(() => {
    if (popup && !popup.closed) { popup.focus(); return; }
    setModalOpen(true);
  }, [popup]);
  const soundboardOpen = modalOpen || Boolean(popup && !popup.closed);
  const value = useMemo(() => ({ openSoundboard, soundboardOpen }), [openSoundboard, soundboardOpen]);
  const soundboardRoot = popup?.document.getElementById("soundboard-root");

  return <SoundboardContext.Provider value={value}>{children}
    {modalOpen ? createPortal(<div aria-label="Soundboard modal" aria-modal="true" className="viewport-overlay z-[70] flex items-center justify-center bg-black/40 p-3 lg:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }} role="dialog"><div className="h-[min(90vh,60rem)] w-full max-w-7xl overflow-hidden rounded-3xl border border-canvas-line bg-canvas-panel shadow-2xl"><Soundboard onToggleWindow={createPopup} /></div></div>, document.querySelector("[data-app-shell]") ?? document.body) : null}
    {soundboardRoot ? createPortal(<Soundboard isPopout onToggleWindow={popIn} />, soundboardRoot) : null}
  </SoundboardContext.Provider>;
}

export function useSoundboard(): Value {
  const context = useContext(SoundboardContext);
  if (!context) throw new Error("Soundboard controls require SoundboardProvider.");
  return context;
}
